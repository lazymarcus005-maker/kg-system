"""
GraphRAG: combines graph traversal (Neo4j Cypher) with LLM generation.
Strategy:
  1. Convert user question to Cypher via LLM
  2. Execute Cypher → structured graph context
  3. Fallback to vector search (Qdrant) if graph returns nothing
  4. Feed context + question to LLM → cited answer
"""
import time
from langchain_neo4j import Neo4jGraph, GraphCypherQAChain
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate

from config import Settings

from llm_factory import build_llm, build_embeddings


CYPHER_GENERATION_PROMPT = PromptTemplate(
    input_variables=["schema", "question"],
    template="""
You are an expert Neo4j Cypher query generator for a Knowledge Graph
containing ISO standards, software requirements, and architecture documents.

Graph schema:
{schema}

Node types: Standard, Clause, Requirement, Control, Component, TestCase, Evidence, Role, Process, Artifact
Relationship types: HAS_CLAUSE, REQUIRES, DERIVED_FROM, PART_OF, IMPLEMENTS, VERIFIED_BY,
                    PRODUCES_EVIDENCE, ASSIGNED_TO, DEPENDS_ON, COMPLIES_WITH, MENTIONS

IMPORTANT: Entity nodes use the property `id` as their name/identifier (NOT `name`).
Always use `n.id` to access entity names. For example:
  - MATCH (n:Standard) WHERE toLower(n.id) CONTAINS 'iso 9001' RETURN n.id, n.description
  - MATCH (s:Standard)-[:HAS_CLAUSE]->(c:Clause) RETURN s.id, c.id, c.description LIMIT 20

Rules:
- Use MATCH with specific labels
- Always RETURN n.id (entity name), n.description for readable results
- For traceability queries: traverse the full path Component→Requirement→Clause→Standard
- Limit results to 20 unless asked otherwise
- Use case-insensitive matching: toLower(n.id) CONTAINS toLower('...')

Question: {question}

Cypher query (no explanation, no markdown fences, just the raw Cypher):
""",
)

QA_PROMPT = PromptTemplate(
    input_variables=["context", "question"],
    template="""
You are a knowledge assistant with access to a structured Knowledge Graph
containing ISO standards (ISO 29148, ISO 12207, ISO 42010, ISO 27001),
software requirements, architecture decisions, and traceability data.

Graph context (structured data):
{context}

Question: {question}

Instructions:
- Answer based on the graph context provided
- Cite specific clause IDs, requirement IDs, or component names from the context
- If context is insufficient, say so and suggest what graph data might be missing
- Format: clear prose with inline citations like (Clause 5.2.5, ISO-29148)

Answer:
""",
)


class GraphRAG:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.llm = build_llm(settings)
        self.embeddings = build_embeddings(settings)

        self.graph = self._connect_neo4j(settings)
        self.qdrant = QdrantClient(
            host=settings.qdrant_host,
            port=settings.qdrant_port,
            check_compatibility=False,  # suppress version mismatch warning
        )

        # LangChain GraphCypherQAChain
        self.cypher_chain = GraphCypherQAChain.from_llm(
            llm=self.llm,
            graph=self.graph,
            cypher_prompt=CYPHER_GENERATION_PROMPT,
            qa_prompt=QA_PROMPT,
            verbose=False,
            return_intermediate_steps=True,
            allow_dangerous_requests=True,
        )

    def _connect_neo4j(self, settings, max_retries: int = 10, delay: int = 10) -> Neo4jGraph:
        """Retry Neo4j connection with backoff — prevents crash loop when Neo4j starts slowly."""
        last_err = None
        for attempt in range(max_retries):
            try:
                g = Neo4jGraph(
                    url=settings.neo4j_uri,
                    username=settings.neo4j_user,
                    password=settings.neo4j_password,
                )
                g.query("RETURN 1")  # verify auth actually works
                print(f"[GraphRAG] Neo4j connected on attempt {attempt + 1}")
                return g
            except Exception as e:
                last_err = e
                print(f"[GraphRAG] Neo4j attempt {attempt + 1}/{max_retries} failed: {e} — retrying in {delay}s")
                time.sleep(delay)
        raise RuntimeError(f"[GraphRAG] Could not connect to Neo4j after {max_retries} attempts: {last_err}")

    @staticmethod
    def _strip_cypher_fence(text: str) -> str:
        """Strip markdown code fences from LLM-generated Cypher (```cypher ... ```)."""
        import re
        text = text.strip()
        # Remove fenced code block: ```cypher\n...\n``` or ```\n...\n```
        text = re.sub(r'^```(?:cypher)?\s*\n?', '', text, flags=re.IGNORECASE)
        text = re.sub(r'\n?```\s*$', '', text)
        return text.strip()

    async def query(self, question: str, history: list = None) -> tuple[str, list]:
        """Main query: try graph first, fallback to vector search.
        All LLM/DB calls run in thread-pool executor so the async event loop stays free.
        """
        import asyncio
        loop = asyncio.get_running_loop()
        try:
            def _run_chain():
                return self.cypher_chain.invoke({"query": question})
            result = await loop.run_in_executor(None, _run_chain)
            answer = result.get("result", "")
            steps = result.get("intermediate_steps", [])

            # Extract Cypher + graph results for source attribution
            sources = []
            for step in steps:
                if isinstance(step, dict) and "query" in step:
                    sources.append({"type": "cypher", "query": step["query"]})
                if isinstance(step, dict) and "context" in step:
                    sources.append({"type": "graph_data", "data": step["context"][:5]})

            if answer and answer.strip() not in ("I don't know.", "", "None"):
                return answer, sources

        except Exception as e:
            print(f"[GraphRAG] Cypher query failed: {e}, falling back to vector search")

        # Fallback: vector search via Qdrant
        return await self._vector_fallback(question)

    async def _vector_fallback(self, question: str) -> tuple[str, list]:
        """RAG fallback when graph query yields nothing."""
        import asyncio
        loop = asyncio.get_running_loop()
        try:
            vector_store = QdrantVectorStore(
                client=self.qdrant,
                collection_name=self.settings.qdrant_collection,
                embedding=self.embeddings,
            )
            retriever = vector_store.as_retriever(search_kwargs={"k": 5})
            qa = RetrievalQA.from_chain_type(llm=self.llm, retriever=retriever)
            def _run_qa():
                return qa.invoke({"query": question})
            result = await loop.run_in_executor(None, _run_qa)
            return result["result"], [{"type": "vector_search", "fallback": True}]
        except Exception as e:
            return f"Could not retrieve answer: {e}", []

    async def nl_to_cypher(self, question: str) -> tuple[str, list]:
        """Translate NL to Cypher and return raw results."""
        import asyncio
        loop = asyncio.get_running_loop()
        schema = self.graph.get_schema
        prompt = CYPHER_GENERATION_PROMPT.format(schema=schema, question=question)
        def _run_llm():
            return self.llm.invoke(prompt)
        cypher_response = await loop.run_in_executor(None, _run_llm)
        cypher = self._strip_cypher_fence(cypher_response.content)
        try:
            results = self.graph.query(cypher)
        except Exception as e:
            results = [{"error": str(e)}]
        return cypher, results

    async def get_neighborhood(self, node_type: str, node_id: str, depth: int = 2) -> dict:
        """Return graph neighborhood of a specific node."""
        cypher = f"""
        MATCH path = (n:{node_type})-[*1..{depth}]-(neighbor)
        WHERE n.id = $node_id OR n.name = $node_id
        RETURN path LIMIT 50
        """
        try:
            results = self.graph.query(cypher, params={"node_id": node_id})
            return {"node_type": node_type, "node_id": node_id, "depth": depth, "results": results}
        except Exception as e:
            return {"error": str(e)}

    async def ping_neo4j(self) -> bool:
        try:
            self.graph.query("RETURN 1")
            return True
        except Exception:
            return False

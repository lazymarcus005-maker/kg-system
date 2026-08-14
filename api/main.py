"""
Query API — OpenAI-compatible chat completions endpoint.
Augments every request with Knowledge Graph context (GraphRAG).

Compatible with: Claude Code, Codex, Gemini, OpenCode, Continue.dev,
                 any tool that supports custom OpenAI base_url.
"""
import os
import time
import json
import uuid
from typing import AsyncIterator, Optional

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from graph_rag import GraphRAG, assert_read_only_cypher
from config import Settings

settings = Settings()
app = FastAPI(title="KG Query API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag: GraphRAG | None = None


def get_rag() -> GraphRAG:
    global rag
    if rag is None:
        rag = GraphRAG(settings)
    return rag

# ── Auth ─────────────────────────────────────────────────────────────
api_key_header = APIKeyHeader(name="Authorization", auto_error=False)


async def verify_key(auth: str | None = Depends(api_key_header)):
    if settings.api_key in ("", "changeme"):
        if settings.insecure_dev_mode:
            return
        raise HTTPException(403, "API key not configured: set QUERY_API_KEY (or INSECURE_DEV_MODE=1 for local dev)")
    token = (auth or "").removeprefix("Bearer ").strip()
    if token != settings.api_key:
        raise HTTPException(401, "Invalid API key")


# ── OpenAI-compatible models ─────────────────────────────────────────
class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str = "kg-graphrag"
    messages: list[Message]
    stream: bool = False
    temperature: float = 0.0
    max_tokens: int | None = None


# ── /v1/chat/completions (OpenAI-compatible) ─────────────────────────
@app.post("/v1/chat/completions", dependencies=[Depends(verify_key)])
async def chat_completions(req: ChatRequest):
    rag = get_rag()
    user_message = next(
        (m.content for m in reversed(req.messages) if m.role == "user"), ""
    )

    if req.stream:
        return StreamingResponse(
            _stream_response(user_message, req.messages),
            media_type="text/event-stream",
        )

    answer, sources = await rag.query(user_message, req.messages)
    return _format_response(answer, sources, req.model)


async def _stream_response(question: str, history: list[Message]) -> AsyncIterator[str]:
    rag = get_rag()
    answer, sources = await rag.query(question, history)
    chunk_id = f"chatcmpl-{uuid.uuid4().hex[:8]}"

    # Stream answer in chunks
    words = answer.split(" ")
    for i, word in enumerate(words):
        chunk = {
            "id": chunk_id,
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": "kg-graphrag",
            "choices": [{"delta": {"content": word + (" " if i < len(words)-1 else "")}, "index": 0}],
        }
        yield f"data: {json.dumps(chunk)}\n\n"

    # Send sources as final metadata chunk
    if sources:
        meta = {"id": chunk_id, "object": "chat.completion.chunk", "created": int(time.time()),
                "model": "kg-graphrag", "choices": [{"delta": {"content": ""}, "index": 0}],
                "kg_sources": sources}
        yield f"data: {json.dumps(meta)}\n\n"

    yield "data: [DONE]\n\n"


def _format_response(answer: str, sources: list, model: str) -> dict:
    return {
        "id": f"chatcmpl-{uuid.uuid4().hex[:8]}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": answer},
            "finish_reason": "stop",
        }],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        "kg_sources": sources,   # extra: graph nodes that contributed
    }


# ── /v1/models (OpenAI-compatible discovery) ─────────────────────────
@app.get("/v1/models", dependencies=[Depends(verify_key)])
async def list_models():
    return {
        "object": "list",
        "data": [
            {"id": "kg-graphrag", "object": "model", "owned_by": "kg-system"},
            {"id": "kg-cypher", "object": "model", "owned_by": "kg-system"},
            {"id": "bge-m3", "object": "model", "owned_by": "BAAI"},
            {"id": settings.embedding_model if settings.embedding_model else "text-embedding-3-small", "object": "model", "owned_by": "embeddings"},
        ],
    }


# ── /embeddings (OpenAI-compatible) ───────────────────────────────────
class EmbeddingRequest(BaseModel):
    model: str = ""
    input: str | list[str]
    encoding_format: str = "float"


@app.post("/embeddings", dependencies=[Depends(verify_key)])
async def embeddings(req: EmbeddingRequest):
    """Generate embeddings — calls the gateway's /v1/embeddings endpoint directly."""
    import httpx
    inputs: list[str] = [req.input] if isinstance(req.input, str) else req.input

    payload = {
        "model": req.model or settings.embedding_model,
        "input": inputs,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{settings.openai_compatible_base_url}/v1/embeddings",
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.openai_compatible_api_key}",
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        return resp.json()


# ── /query/cypher — NL→Cypher endpoint ───────────────────────────────
class CypherRequest(BaseModel):
    question: str


@app.post("/query/cypher", dependencies=[Depends(verify_key)])
async def query_cypher(req: CypherRequest):
    """Translate natural language to Cypher and return raw graph data."""
    rag = get_rag()
    cypher, results = await rag.nl_to_cypher(req.question)
    return {"cypher": cypher, "results": results}


# ── /run/cypher — direct Cypher execution (for export/tools) ─────────
class RawCypherRequest(BaseModel):
    cypher: str


@app.post("/run/cypher", dependencies=[Depends(verify_key)])
async def run_cypher(req: RawCypherRequest):
    """Execute a raw Cypher query directly (no NL translation)."""
    rag = get_rag()
    try:
        assert_read_only_cypher(req.cypher)
    except ValueError:
        raise HTTPException(403, "Only read-only Cypher is allowed")
    try:
        results = rag.graph.query(req.cypher)
    except Exception as e:
        raise HTTPException(400, str(e))
    return {"cypher": req.cypher, "results": results}


# ── /query/graph — graph traversal endpoint ───────────────────────────
class GraphRequest(BaseModel):
    node_type: str
    node_id: str
    depth: int = Field(2, ge=1, le=5)


@app.post("/query/graph", dependencies=[Depends(verify_key)])
async def query_graph(req: GraphRequest):
    """Return neighborhood of a graph node up to given depth."""
    rag = get_rag()
    try:
        result = await rag.get_neighborhood(req.node_type, req.node_id, req.depth)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return result


# ── Health ────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    neo4j_ok = await get_rag().ping_neo4j()
    return {"status": "ok", "neo4j": neo4j_ok, "provider": settings.llm_provider}


# ── Graph Stats ───────────────────────────────────────────────────────
@app.get("/graph/stats", dependencies=[Depends(verify_key)])
async def graph_stats():
    """Return aggregate graph statistics for Dashboard."""
    rag = get_rag()
    node_count = rag.graph.query("MATCH (n) RETURN count(n) AS c")[0]["c"]
    rel_count = rag.graph.query("MATCH ()-[r]->() RETURN count(r) AS c")[0]["c"]
    doc_count = rag.graph.query("MATCH (n:Document) RETURN count(n) AS c")[0]["c"]
    return {"nodes": node_count, "relations": rel_count, "documents": doc_count}


# ── Entities ──────────────────────────────────────────────────────────
@app.get("/entities", dependencies=[Depends(verify_key)])
async def list_entities(
    type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """List __Entity__ nodes with optional type/search filter, paginated."""
    rag = get_rag()
    params: dict = {
        "type_filter": type,
        "search": search.lower() if search else None,
        "skip": skip,
        "limit": limit,
    }
    # LLMGraphTransformer stores entity identifier in n.id (not n.name)
    count_cypher = """
    MATCH (n:__Entity__)
    WHERE ($type_filter IS NULL OR $type_filter IN labels(n))
      AND ($search IS NULL OR toLower(coalesce(n.id, n.name, '')) CONTAINS $search)
    RETURN count(n) AS total
    """
    data_cypher = """
    MATCH (n:__Entity__)
    WHERE ($type_filter IS NULL OR $type_filter IN labels(n))
      AND ($search IS NULL OR toLower(coalesce(n.id, n.name, '')) CONTAINS $search)
    RETURN elementId(n) AS id,
           labels(n) AS labels,
           coalesce(n.id, n.name) AS name,
           n.description AS description,
           coalesce(n.status, 'unverified') AS status
    ORDER BY coalesce(n.id, n.name)
    SKIP $skip LIMIT $limit
    """
    total_result = rag.graph.query(count_cypher, params=params)
    total = total_result[0]["total"] if total_result else 0
    items = rag.graph.query(data_cypher, params=params)
    return {"total": total, "items": items}


# ── Relations ─────────────────────────────────────────────────────────
@app.get("/relations", dependencies=[Depends(verify_key)])
async def list_relations(
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """List relations with optional status filter, paginated. Includes status counts."""
    rag = get_rag()
    params: dict = {"status_filter": status, "skip": skip, "limit": limit}
    data_cypher = """
    MATCH (a:__Entity__)-[r]->(b:__Entity__)
    WHERE $status_filter IS NULL OR coalesce(r.status, 'pending') = $status_filter
    RETURN elementId(r) AS id,
           type(r) AS relation_type,
           coalesce(a.id, a.name) AS source_name, elementId(a) AS source_id,
           coalesce(b.id, b.name) AS target_name, elementId(b) AS target_id,
           r.confidence AS confidence,
           r.evidence AS evidence,
           coalesce(r.status, 'pending') AS status
    ORDER BY r.confidence DESC
    SKIP $skip LIMIT $limit
    """
    counts_cypher = """
    MATCH (a:__Entity__)-[r]->(b:__Entity__)
    RETURN
      count(CASE WHEN coalesce(r.status, 'pending') = 'pending'  THEN 1 END) AS pending,
      count(CASE WHEN coalesce(r.status, 'pending') = 'approved' THEN 1 END) AS approved,
      count(CASE WHEN coalesce(r.status, 'pending') = 'rejected' THEN 1 END) AS rejected
    """
    items = rag.graph.query(data_cypher, params=params)
    counts_result = rag.graph.query(counts_cypher)
    counts = counts_result[0] if counts_result else {"pending": 0, "approved": 0, "rejected": 0}
    return {"items": items, "counts": counts}


# ── Update Relation Status ────────────────────────────────────────────
class RelationStatusUpdate(BaseModel):
    status: str  # "approved" | "rejected"


@app.patch("/relations/{relation_id}", dependencies=[Depends(verify_key)])
async def update_relation_status(relation_id: str, body: RelationStatusUpdate):
    """Approve or reject a relation by its Neo4j elementId."""
    rag = get_rag()
    if body.status not in ("approved", "rejected"):
        raise HTTPException(400, "status must be 'approved' or 'rejected'")
    cypher = """
    MATCH ()-[r]->() WHERE elementId(r) = $rid
    SET r.status = $status, r.reviewed_at = datetime()
    RETURN elementId(r) AS id, r.status AS status
    """
    result = rag.graph.query(cypher, params={"rid": relation_id, "status": body.status})
    if not result:
        raise HTTPException(404, "Relation not found")
    return result[0]


# ── Ontology ──────────────────────────────────────────────────────────
@app.get("/ontology", dependencies=[Depends(verify_key)])
async def get_ontology():
    """Return all node labels (excluding __Entity__) and relation types with counts."""
    rag = get_rag()
    labels_cypher = """
    MATCH (n:__Entity__)
    UNWIND [l IN labels(n) WHERE l <> '__Entity__'] AS label
    RETURN label AS name, count(*) AS count
    ORDER BY count DESC
    """
    rel_types_cypher = """
    MATCH ()-[r]->()
    RETURN type(r) AS name, count(*) AS count
    ORDER BY count DESC
    """
    node_types = rag.graph.query(labels_cypher)
    relation_types = rag.graph.query(rel_types_cypher)
    return {"node_types": node_types, "relation_types": relation_types}


# ── Graph Node Search ─────────────────────────────────────────────────
@app.get("/graph/nodes", dependencies=[Depends(verify_key)])
async def search_graph_nodes(
    search: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Search entity nodes by name for Graph Explorer."""
    rag = get_rag()
    cypher = """
    MATCH (n:__Entity__)
    WHERE toLower(coalesce(n.id, n.name, '')) CONTAINS toLower($search)
    RETURN elementId(n) AS id, coalesce(n.id, n.name) AS name, labels(n) AS labels,
           n.description AS description
    LIMIT $limit
    """
    results = rag.graph.query(cypher, params={"search": search, "limit": limit})
    return {"results": results}


class CreateNodeRequest(BaseModel):
    name: str
    label: str
    description: str = ""


@app.post("/graph/nodes", dependencies=[Depends(verify_key)], status_code=201)
async def create_graph_node(body: CreateNodeRequest):
    """Create a new entity node in the knowledge graph."""
    rag = get_rag()
    # Sanitise label — alphanumeric + underscore only to prevent Cypher injection
    import re
    safe_label = re.sub(r"[^A-Za-z0-9_]", "_", body.label.strip())
    if not safe_label:
        raise HTTPException(400, "Invalid label")

    cypher = f"""
    MERGE (n:__Entity__:`{safe_label}` {{id: $name}})
    ON CREATE SET n.name = $name, n.description = $description, n.created_at = timestamp()
    ON MATCH  SET n.description = CASE WHEN $description <> '' THEN $description ELSE n.description END
    RETURN elementId(n) AS id, coalesce(n.id, n.name) AS name, labels(n) AS labels,
           n.description AS description
    """
    results = rag.graph.query(cypher, params={"name": body.name.strip(), "description": body.description.strip()})
    if not results:
        raise HTTPException(500, "Node creation failed")
    return results[0]


# ── Graph Visualization ────────────────────────────────────────────
@app.get("/graph/visualization", dependencies=[Depends(verify_key)])
async def get_graph_visualization(limit: int = Query(100, ge=10, le=500)):
    """Get graph nodes and edges for visualization (limited to prevent browser overload)."""
    rag = get_rag()
    # Fetch limited nodes and their direct relationships
    cypher = """
    MATCH (n:__Entity__)
    WITH n LIMIT $limit
    OPTIONAL MATCH (n)-[r]->(m:__Entity__)
    WITH n, r, m, [x IN labels(n) WHERE x <> '__Entity__'][0] AS node_type
    RETURN {
      id: elementId(n),
      name: coalesce(n.id, n.name),
      type: coalesce(node_type, 'Unknown')
    } AS node, 
    {
      source: elementId(n),
      target: elementId(m),
      relation: type(r)
    } AS edge
    """
    
    all_results = rag.graph.query(cypher, params={"limit": limit})
    
    nodes_dict = {}
    edges = []
    
    for row in all_results:
        if row.get("node"):
            node_data = row["node"]
            nodes_dict[node_data["id"]] = node_data
        if row.get("edge") and row["edge"].get("target"):
            edges.append(row["edge"])
    
    nodes = list(nodes_dict.values())
    return {"nodes": nodes, "edges": edges, "total_nodes": len(nodes), "total_edges": len(edges)}

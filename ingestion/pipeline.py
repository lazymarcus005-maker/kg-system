"""
IngestionPipeline: PDF → text chunks → graph triples → Neo4j + Qdrant
Supports: OpenAI, Anthropic, Google, Ollama
"""
import time
from pathlib import Path
from typing import Any

from langchain_community.document_loaders import PDFPlumberLoader, PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_experimental.graph_transformers import LLMGraphTransformer
from langchain_neo4j import Neo4jGraph
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

from config import Settings
from llm_factory import build_llm, build_embeddings


class IngestionPipeline:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.llm = build_llm(settings)
        self.embeddings = build_embeddings(settings)

        # Neo4j connection (with retry — Neo4j may not be auth-ready immediately)
        self.graph = self._connect_neo4j(settings)

        # Qdrant setup
        self.qdrant_client = QdrantClient(
            host=settings.qdrant_host,
            port=settings.qdrant_port,
            check_compatibility=False,  # suppress version mismatch warning
        )
        self._ensure_qdrant_collection()

        # Text splitter
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            separators=["\n\n", "\n", ". ", " "],
        )

        # Graph transformer (entity + relation extraction)
        self.graph_transformer = LLMGraphTransformer(
            llm=self.llm,
            # Predefined node/edge types for ISO/software domain
            allowed_nodes=[
                "Standard", "Clause", "Requirement", "Control",
                "Component", "TestCase", "Evidence", "Role",
                "Process", "Artifact", "Constraint",
            ],
            allowed_relationships=[
                "HAS_CLAUSE", "REQUIRES", "DERIVED_FROM", "PART_OF",
                "IMPLEMENTS", "VERIFIED_BY", "PRODUCES_EVIDENCE",
                "ASSIGNED_TO", "DEPENDS_ON", "COMPLIES_WITH",
            ],
            node_properties=["description", "source", "doc_type"],
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
                print(f"[Pipeline] Neo4j connected on attempt {attempt + 1}")
                return g
            except Exception as e:
                last_err = e
                print(f"[Pipeline] Neo4j attempt {attempt + 1}/{max_retries} failed: {e} — retrying in {delay}s")
                time.sleep(delay)
        raise RuntimeError(f"[Pipeline] Could not connect to Neo4j after {max_retries} attempts: {last_err}")

    def _ensure_qdrant_collection(self):
        existing = [c.name for c in self.qdrant_client.get_collections().collections]
        if self.settings.qdrant_collection in existing:
            info = self.qdrant_client.get_collection(self.settings.qdrant_collection)
            vectors = info.config.params.vectors
            if isinstance(vectors, dict):
                vectors = next(iter(vectors.values()))
            if vectors.size != self.settings.qdrant_vector_size:
                raise RuntimeError(
                    f"[Pipeline] Qdrant collection '{self.settings.qdrant_collection}' has vector size "
                    f"{vectors.size}, but EMBEDDING_MODEL produces {self.settings.qdrant_vector_size}-dim "
                    "vectors (QDRANT_VECTOR_SIZE mismatch). Delete the qdrant volume "
                    "(docker compose down -v) or set QDRANT_VECTOR_SIZE to match the embedding model."
                )
            return
        self.qdrant_client.create_collection(
            collection_name=self.settings.qdrant_collection,
            vectors_config=VectorParams(size=self.settings.qdrant_vector_size, distance=Distance.COSINE),
        )

    def _load_pdf(self, file_path: Path) -> list:
        """Try multiple loaders in order; fallback to tesseract OCR for scanned PDFs."""
        # 1. PDFPlumber (best for digital PDFs)
        try:
            docs = PDFPlumberLoader(str(file_path)).load()
            total_chars = sum(len(d.page_content.strip()) for d in docs)
            print(f"[Pipeline] PDFPlumber: {len(docs)} pages, {total_chars} chars")
            if total_chars > 50:
                return docs
        except Exception as e:
            print(f"[Pipeline] PDFPlumber failed: {e}")

        # 2. PyPDF (fallback for some digital PDFs)
        try:
            docs = PyPDFLoader(str(file_path)).load()
            total_chars = sum(len(d.page_content.strip()) for d in docs)
            print(f"[Pipeline] PyPDF: {len(docs)} pages, {total_chars} chars")
            if total_chars > 50:
                return docs
        except Exception as e:
            print(f"[Pipeline] PyPDF failed: {e}")

        # 3. Tesseract OCR (for scanned/image-based PDFs)
        return self._load_pdf_ocr(file_path)

    def _load_pdf_ocr(self, file_path: Path) -> list:
        """Convert PDF pages to images, then OCR each page with tesseract."""
        try:
            import pytesseract
            from pdf2image import convert_from_path
            from langchain.schema import Document

            print(f"[Pipeline] OCR: converting {file_path} to images...")
            images = convert_from_path(str(file_path), dpi=200)
            print(f"[Pipeline] OCR: {len(images)} page images, running tesseract...")

            docs = []
            for page_num, img in enumerate(images, start=1):
                text = pytesseract.image_to_string(img, lang="eng")
                if text.strip():
                    docs.append(Document(
                        page_content=text,
                        metadata={"page": page_num, "source": str(file_path)},
                    ))

            total_chars = sum(len(d.page_content.strip()) for d in docs)
            print(f"[Pipeline] OCR: {len(docs)} pages with text, {total_chars} chars total")
            return docs
        except Exception as e:
            print(f"[Pipeline] OCR failed: {e}")
            return []

    async def ingest(self, file_path: Path, metadata: dict) -> dict:
        """Full pipeline: PDF → chunks → graph + vectors.
        All heavy synchronous work runs in a thread-pool executor so the
        FastAPI event loop stays free to handle other requests.
        """
        import asyncio
        loop = asyncio.get_running_loop()

        # 1. Load PDF — potentially OCR, keep off event loop
        print(f"[Pipeline] Loading PDF: {file_path}")
        raw_docs = await loop.run_in_executor(None, self._load_pdf, file_path)
        print(f"[Pipeline] Loaded {len(raw_docs)} pages")

        # Inject metadata into each page
        for doc in raw_docs:
            doc.metadata.update(metadata)

        # 2. Chunk
        chunks = self.splitter.split_documents(raw_docs)
        print(f"[Pipeline] Split into {len(chunks)} chunks")

        if not chunks:
            return {"pages": len(raw_docs), "chunks": 0, "nodes": 0, "relationships": 0}

        # 3. Store vectors in Qdrant (sync SDK → thread pool)
        def _add_to_qdrant():
            vector_store = QdrantVectorStore(
                client=self.qdrant_client,
                collection_name=self.settings.qdrant_collection,
                embedding=self.embeddings,
            )
            vector_store.add_documents(chunks)
            print(f"[Pipeline] Qdrant: added {len(chunks)} chunks")

        await loop.run_in_executor(None, _add_to_qdrant)

        # 4. Extract entities + relationships → Neo4j (LLM calls → thread pool)
        graph_docs = []
        if self.settings.extract_entities:
            def _extract_and_store():
                gd = self.graph_transformer.convert_to_graph_documents(chunks)
                self.graph.add_graph_documents(
                    gd,
                    baseEntityLabel=True,   # adds __Entity__ label for easy lookup
                    include_source=True,     # links nodes back to source Document
                )
                print(f"[Pipeline] Neo4j: {sum(len(g.nodes) for g in gd)} nodes, {sum(len(g.relationships) for g in gd)} rels")
                return gd

            graph_docs = await loop.run_in_executor(None, _extract_and_store)

        # 5. Create indexes on first run
        await loop.run_in_executor(None, self._ensure_indexes)

        return {
            "pages": len(raw_docs),
            "chunks": len(chunks),
            "nodes": sum(len(g.nodes) for g in graph_docs),
            "relationships": sum(len(g.relationships) for g in graph_docs),
        }

    def _ensure_indexes(self):
        """Idempotent index creation for common node types."""
        index_queries = [
            "CREATE INDEX req_id IF NOT EXISTS FOR (r:Requirement) ON (r.id)",
            "CREATE INDEX clause_id IF NOT EXISTS FOR (c:Clause) ON (c.id)",
            "CREATE INDEX component_id IF NOT EXISTS FOR (c:Component) ON (c.id)",
            "CREATE INDEX standard_id IF NOT EXISTS FOR (s:Standard) ON (s.id)",
        ]
        for q in index_queries:
            try:
                self.graph.query(q)
            except Exception:
                pass

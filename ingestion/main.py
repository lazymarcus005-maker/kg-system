"""
Ingestion service: PDF → chunks → entities/relations → Neo4j + Qdrant
"""
import os
import shutil
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel

from pipeline import IngestionPipeline
from config import Settings

settings = Settings()

api_key_header = APIKeyHeader(name="Authorization", auto_error=False)


async def verify_key(auth: str | None = Depends(api_key_header)):
    if settings.api_key in ("", "changeme"):
        if settings.insecure_dev_mode:
            return
        raise HTTPException(403, "API key not configured: set API_KEY (or INSECURE_DEV_MODE=1 for local dev)")
    token = (auth or "").removeprefix("Bearer ").strip()
    if token != settings.api_key:
        raise HTTPException(401, "Invalid API key")

# Pipeline is initialized in background after server starts (avoids blocking event loop)
_pipeline: IngestionPipeline | None = None
_pipeline_ready = asyncio.Event()


async def _init_pipeline():
    """Initialize pipeline in a thread pool so time.sleep() doesn't block uvicorn."""
    global _pipeline
    loop = asyncio.get_running_loop()
    for attempt in range(20):
        try:
            p = await loop.run_in_executor(None, lambda: IngestionPipeline(settings))
            _pipeline = p
            _pipeline_ready.set()
            print("[App] Ingestion pipeline ready")
            return
        except Exception as e:
            print(f"[App] Pipeline init attempt {attempt + 1}/20 failed: {e}")
            await asyncio.sleep(5)
    print("[App] ERROR: Could not initialize pipeline after 20 attempts")


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(_init_pipeline())   # non-blocking — server starts immediately
    yield


app = FastAPI(title="KG Ingestion API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

INPUT_DIR = Path("/app/input")
PROCESSED_DIR = Path("/app/processed")
INPUT_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

# ── Job tracking (in-memory; replace with Redis for production) ──────
jobs: dict[str, dict] = {}


class IngestResponse(BaseModel):
    job_id: str
    filename: str
    status: str


async def run_ingestion(job_id: str, file_path: Path, metadata: dict):
    # Wait up to 120s for pipeline to finish initializing
    try:
        await asyncio.wait_for(_pipeline_ready.wait(), timeout=120)
    except asyncio.TimeoutError:
        jobs[job_id].update({"status": "error", "error": "Pipeline not ready (Neo4j/Qdrant unavailable)"})
        return

    jobs[job_id]["status"] = "processing"
    try:
        result = await _pipeline.ingest(file_path, metadata)
        jobs[job_id].update({"status": "done", "result": result})
        shutil.move(str(file_path), PROCESSED_DIR / file_path.name)
    except Exception as e:
        jobs[job_id].update({"status": "error", "error": str(e)})


@app.post("/ingest", response_model=IngestResponse, dependencies=[Depends(verify_key)])
async def ingest_pdf(
    background_tasks: BackgroundTasks,
    file: Annotated[UploadFile, File()],
    source: str = "unknown",
    doc_type: str = "general",
):
    """Upload a PDF for ingestion into the Knowledge Graph."""
    filename = Path(file.filename or "").name
    if not filename or not filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    dest = INPUT_DIR / filename
    if not dest.resolve().is_relative_to(INPUT_DIR.resolve()):
        raise HTTPException(400, "Invalid filename")

    job_id = f"job_{os.urandom(4).hex()}"
    max_bytes = settings.max_upload_mb * 1024 * 1024
    written = 0
    try:
        with dest.open("wb") as f:
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)
                if written > max_bytes:
                    raise HTTPException(413, "File too large")
                f.write(chunk)
    except HTTPException:
        dest.unlink(missing_ok=True)
        raise

    jobs[job_id] = {"status": "queued", "filename": filename}
    metadata = {"source": source, "doc_type": doc_type, "filename": filename}

    background_tasks.add_task(run_ingestion, job_id, dest, metadata)
    return IngestResponse(job_id=job_id, filename=filename, status="queued")


@app.get("/jobs/{job_id}", dependencies=[Depends(verify_key)])
async def get_job(job_id: str):
    if job_id not in jobs:
        raise HTTPException(404, "Job not found")
    return jobs[job_id]


@app.get("/jobs", dependencies=[Depends(verify_key)])
async def list_jobs():
    return jobs


@app.post("/ingest/watch", dependencies=[Depends(verify_key)])
async def watch_input_dir(background_tasks: BackgroundTasks):
    """Trigger ingestion for all PDFs already in /app/input."""
    triggered = []
    for pdf in INPUT_DIR.glob("*.pdf"):
        job_id = f"job_{os.urandom(4).hex()}"
        jobs[job_id] = {"status": "queued", "filename": pdf.name}
        metadata = {"source": "watch", "doc_type": "general", "filename": pdf.name}
        background_tasks.add_task(run_ingestion, job_id, pdf, metadata)
        triggered.append({"job_id": job_id, "file": pdf.name})
    return {"triggered": triggered}


@app.get("/health")
async def health():
    return {"status": "ok", "provider": settings.llm_provider}


@app.get("/config", dependencies=[Depends(verify_key)])
async def get_config():
    """Return read-only runtime configuration (API keys are masked)."""
    api_key = settings.openai_compatible_api_key
    masked_key = (api_key[:8] + "..." + api_key[-4:]) if len(api_key) > 12 else "***"
    return {
        "llm": {
            "provider": settings.llm_provider,
            "openai_compatible_base_url": settings.openai_compatible_base_url,
            "openai_compatible_model": settings.openai_compatible_model,
            "openai_compatible_api_key": masked_key,
        },
        "embedding": {
            "provider": settings.embedding_provider,
            "model": settings.embedding_model,
            "dimension": settings.embedding_dimension,
        },
    }

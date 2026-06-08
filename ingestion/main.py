"""
Ingestion service: PDF → chunks → entities/relations → Neo4j + Qdrant
"""
import os
import shutil
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from pipeline import IngestionPipeline
from config import Settings

settings = Settings()

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
    allow_origins=["*"],
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


@app.post("/ingest", response_model=IngestResponse)
async def ingest_pdf(
    background_tasks: BackgroundTasks,
    file: Annotated[UploadFile, File()],
    source: str = "unknown",
    doc_type: str = "general",
):
    """Upload a PDF for ingestion into the Knowledge Graph."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    job_id = f"job_{os.urandom(4).hex()}"
    dest = INPUT_DIR / file.filename
    with dest.open("wb") as f:
        f.write(await file.read())

    jobs[job_id] = {"status": "queued", "filename": file.filename}
    metadata = {"source": source, "doc_type": doc_type, "filename": file.filename}

    background_tasks.add_task(run_ingestion, job_id, dest, metadata)
    return IngestResponse(job_id=job_id, filename=file.filename, status="queued")


@app.get("/jobs/{job_id}")
async def get_job(job_id: str):
    if job_id not in jobs:
        raise HTTPException(404, "Job not found")
    return jobs[job_id]


@app.get("/jobs")
async def list_jobs():
    return jobs


@app.post("/ingest/watch")
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

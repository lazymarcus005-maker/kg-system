import os
import time

import httpx
import pytest

QUERY_API_URL = os.environ.get("QUERY_API_URL", "http://localhost:8000")
INGESTION_API_URL = os.environ.get("INGESTION_API_URL", "http://localhost:8001")
MCP_API_URL = os.environ.get("MCP_API_URL", "http://localhost:8002")
WEB_URL = os.environ.get("WEB_URL", "http://localhost:5173")
QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
API_KEY = os.environ.get("QUERY_API_KEY", "changeme")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "changeme")


def make_pdf(text: str) -> bytes:
    """Build a minimal valid single-page PDF containing `text` (no deps)."""
    safe = "".join(c for c in text if 32 <= ord(c) < 127)
    stream = f"BT /F1 24 Tf 72 720 Td ({safe}) Tj ET".encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for num, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{num} 0 obj\n".encode() + body + b"\nendobj\n"
    xref_pos = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n".encode()
    out += f"startxref\n{xref_pos}\n%%EOF\n".encode()
    return bytes(out)


def _wait(url, timeout=240, check=None, name="service"):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        try:
            r = httpx.get(url, timeout=10)
            if check is None or check(r):
                return r
            last = f"status={r.status_code} body={r.text[:120]}"
        except Exception as e:
            last = repr(e)
        time.sleep(3)
    pytest.fail(f"Timed out waiting for {name} at {url}: {last}")


@pytest.fixture(scope="session")
def ready():
    """Block until every service (and the seed data) is actually ready."""
    _wait(
        f"{QUERY_API_URL}/health",
        check=lambda r: r.status_code == 200 and r.json().get("neo4j") is True,
        name="query-api(+neo4j)",
    )
    _wait(f"{INGESTION_API_URL}/health", check=lambda r: r.status_code == 200, name="ingestion")
    _wait(f"{MCP_API_URL}/health", check=lambda r: r.status_code == 200, name="mcp-server")
    _wait(f"{WEB_URL}/", check=lambda r: r.status_code == 200, name="web")

    hdr = {"Authorization": f"Bearer {API_KEY}"}
    deadline = time.time() + 180
    while time.time() < deadline:
        try:
            r = httpx.post(
                f"{QUERY_API_URL}/run/cypher",
                json={"cypher": "MATCH (s:Standard) RETURN count(s) AS c"},
                headers=hdr,
                timeout=10,
            )
            if r.status_code == 200 and r.json()["results"][0]["c"] >= 5:
                return True
        except Exception:
            pass
        time.sleep(3)
    pytest.fail("Seed ISO standards were never applied by neo4j-init")


@pytest.fixture(scope="session")
def auth():
    return {"Authorization": f"Bearer {API_KEY}"}


@pytest.fixture(scope="session")
def client():
    with httpx.Client(timeout=60) as c:
        yield c


@pytest.fixture(scope="session")
def pdf_bytes():
    return make_pdf("Knowledge Graph end to end test document for ISO traceability")

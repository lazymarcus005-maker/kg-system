import time
import uuid

from conftest import (
    INGESTION_API_URL,
    MCP_API_URL,
    QDRANT_URL,
    QUERY_API_URL,
    WEB_URL,
)


# ── Security / auth wall ─────────────────────────────────────────────
class TestAuth:
    def test_query_api_rejects_missing_key(self, ready, client):
        r = client.get(f"{QUERY_API_URL}/v1/models")
        assert r.status_code in (401, 403)

    def test_query_api_rejects_wrong_key(self, ready, client):
        r = client.get(
            f"{QUERY_API_URL}/v1/models",
            headers={"Authorization": "Bearer wrong-key"},
        )
        assert r.status_code == 401

    def test_query_api_accepts_valid_key(self, ready, client, auth):
        r = client.get(f"{QUERY_API_URL}/v1/models", headers=auth)
        assert r.status_code == 200
        ids = [m["id"] for m in r.json()["data"]]
        assert "kg-graphrag" in ids

    def test_ingestion_rejects_missing_key(self, ready, client):
        r = client.get(f"{INGESTION_API_URL}/jobs")
        assert r.status_code in (401, 403)

    def test_health_is_public(self, ready, client):
        assert client.get(f"{QUERY_API_URL}/health").status_code == 200
        assert client.get(f"{INGESTION_API_URL}/health").status_code == 200
        assert client.get(f"{MCP_API_URL}/health").status_code == 200


# ── Ingestion: PDF → chunks → Qdrant ─────────────────────────────────
class TestIngestion:
    def test_rejects_non_pdf(self, ready, client, auth):
        files = {"file": ("notes.txt", b"hello", "text/plain")}
        r = client.post(f"{INGESTION_API_URL}/ingest", headers=auth, files=files)
        assert r.status_code == 400

    def test_ingest_pdf_end_to_end(self, ready, client, auth, pdf_bytes):
        filename = f"e2e_{uuid.uuid4().hex[:8]}.pdf"
        before = _qdrant_points()

        files = {"file": (filename, pdf_bytes, "application/pdf")}
        data = {"source": "e2e", "doc_type": "test"}
        r = client.post(f"{INGESTION_API_URL}/ingest", headers=auth, files=files, data=data)
        assert r.status_code == 200, r.text
        job_id = r.json()["job_id"]

        result = _wait_for_job(client, auth, job_id, timeout=300)
        assert result["status"] == "done", result
        assert result["result"]["pages"] >= 1
        assert result["result"]["chunks"] >= 1

        after = _qdrant_points()
        assert after > before, f"expected new vectors in Qdrant ({before} -> {after})"


# ── Query API (GraphRAG over Neo4j) ──────────────────────────────────
class TestQuery:
    def test_chat_completions(self, ready, client, auth):
        r = client.post(
            f"{QUERY_API_URL}/v1/chat/completions",
            headers=auth,
            json={
                "model": "kg-graphrag",
                "messages": [{"role": "user", "content": "ISO 29148 clause 5.2 คืออะไร"}],
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        content = body["choices"][0]["message"]["content"]
        assert content.strip() != ""
        assert "kg_sources" in body

    def test_query_cypher_translation(self, ready, client, auth):
        r = client.post(
            f"{QUERY_API_URL}/query/cypher",
            headers=auth,
            json={"question": "how many nodes are in the graph"},
        )
        assert r.status_code == 200, r.text
        assert "cypher" in r.json()

    def test_run_cypher_readonly_guard(self, ready, client, auth):
        r = client.post(
            f"{QUERY_API_URL}/run/cypher",
            headers=auth,
            json={"cypher": "MATCH (n) DETACH DELETE n"},
        )
        assert r.status_code == 403

        r = client.post(
            f"{QUERY_API_URL}/run/cypher",
            headers=auth,
            json={"cypher": "MATCH (n) RETURN count(n) AS c"},
        )
        assert r.status_code == 200
        assert r.json()["results"][0]["c"] >= 0

    def test_graph_stats(self, ready, client, auth):
        r = client.get(f"{QUERY_API_URL}/graph/stats", headers=auth)
        assert r.status_code == 200
        body = r.json()
        assert body["nodes"] > 0  # seed data present

    def test_seed_standards_present(self, ready, client, auth):
        r = client.post(
            f"{QUERY_API_URL}/run/cypher",
            headers=auth,
            json={"cypher": "MATCH (s:Standard) RETURN count(s) AS c"},
        )
        assert r.json()["results"][0]["c"] >= 5

    def test_neighborhood_rejects_bad_label(self, ready, client, auth):
        r = client.post(
            f"{QUERY_API_URL}/query/graph",
            headers=auth,
            json={"node_type": "NotALabel", "node_id": "x", "depth": 1},
        )
        assert r.status_code == 400

    def test_neighborhood_accepts_seed_node(self, ready, client, auth):
        r = client.post(
            f"{QUERY_API_URL}/query/graph",
            headers=auth,
            json={"node_type": "Standard", "node_id": "ISO-29148", "depth": 1},
        )
        assert r.status_code == 200, r.text


# ── MCP server ───────────────────────────────────────────────────────
class TestMCP:
    def test_tools_list(self, ready, client):
        r = client.get(f"{MCP_API_URL}/tools/list")
        assert r.status_code == 200
        names = {t["name"] for t in r.json()["tools"]}
        assert {"kg_query", "kg_cypher", "kg_neighborhood"} <= names

    def test_tool_call_query(self, ready, client):
        r = client.post(
            f"{MCP_API_URL}/tools/call",
            json={"name": "kg_query", "arguments": {"question": "what is ISO 29148"}},
        )
        assert r.status_code == 200, r.text
        text = r.json()["content"][0]["text"]
        assert "answer" in text


# ── Web control panel ────────────────────────────────────────────────
class TestWeb:
    def test_serves_spa(self, ready, client):
        r = client.get(f"{WEB_URL}/")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")
        assert "<div id=\"root\">" in r.text or "root" in r.text


# ── helpers ──────────────────────────────────────────────────────────
def _qdrant_points() -> int:
    import httpx

    r = httpx.get(f"{QDRANT_URL}/collections/kg_documents", timeout=15)
    if r.status_code != 200:
        return 0
    return r.json()["result"]["points_count"]


def _wait_for_job(client, auth, job_id, timeout=300):
    deadline = time.time() + timeout
    last = {}
    while time.time() < deadline:
        r = client.get(f"{INGESTION_API_URL}/jobs/{job_id}", headers=auth)
        last = r.json()
        if last.get("status") in ("done", "error"):
            return last
        time.sleep(3)
    return last

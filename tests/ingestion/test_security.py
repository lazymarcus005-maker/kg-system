"""
Security tests for the ingestion API: filename sanitization, fail-closed
API key auth, and upload size limits.
"""
import asyncio

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import main


# ── sanitize_filename ────────────────────────────────────────────────
def test_sanitize_strips_path_traversal():
    assert main.sanitize_filename("../evil.pdf") == "evil.pdf"
    assert main.sanitize_filename("/tmp/uploads/evil.pdf") == "evil.pdf"


@pytest.mark.parametrize("name", ["../../etc/passwd", "x.exe", "", None, "notes.txt"])
def test_sanitize_rejects_bad_input(name):
    with pytest.raises(HTTPException) as exc:
        main.sanitize_filename(name)
    assert exc.value.status_code == 400


def test_sanitize_accepts_plain_pdf():
    assert main.sanitize_filename("report.pdf") == "report.pdf"


# ── stream_to_disk size limit ────────────────────────────────────────
class FakeUpload:
    def __init__(self, chunks):
        self._chunks = list(chunks)

    async def read(self, size=-1):
        if self._chunks:
            return self._chunks.pop(0)
        return b""


def test_stream_to_disk_writes_all_chunks(tmp_path):
    dest = tmp_path / "out.pdf"
    written = asyncio.run(
        main.stream_to_disk(FakeUpload([b"abc", b"def"]), dest, max_bytes=100)
    )
    assert written == 6
    assert dest.read_bytes() == b"abcdef"


def test_stream_to_disk_enforces_limit(tmp_path):
    dest = tmp_path / "big.pdf"
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            main.stream_to_disk(FakeUpload([b"x" * 20]), dest, max_bytes=10)
        )
    assert exc.value.status_code == 413
    assert not dest.exists()


# ── verify_key fail-closed ───────────────────────────────────────────
@pytest.fixture()
def client():
    return TestClient(main.app)


def test_jobs_forbidden_when_key_not_configured(client, monkeypatch):
    monkeypatch.setattr(main.settings, "api_key", "changeme")
    monkeypatch.setattr(main.settings, "insecure_dev_mode", False)
    resp = client.get("/jobs", headers={"Authorization": "Bearer whatever"})
    assert resp.status_code == 403


def test_jobs_auth_flow(client, monkeypatch):
    monkeypatch.setattr(main.settings, "api_key", "secret123")
    monkeypatch.setattr(main.settings, "insecure_dev_mode", False)

    assert client.get("/jobs").status_code == 401
    assert client.get("/jobs", headers={"Authorization": "Bearer wrong"}).status_code == 401
    resp = client.get("/jobs", headers={"Authorization": "Bearer secret123"})
    assert resp.status_code == 200


def test_health_reachable_without_auth(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_config_masks_api_key(client, monkeypatch):
    monkeypatch.setattr(main.settings, "api_key", "secret123")
    monkeypatch.setattr(main.settings, "insecure_dev_mode", False)
    monkeypatch.setattr(main.settings, "openai_compatible_api_key", "sk-supersecret9999")
    resp = client.get("/config", headers={"Authorization": "Bearer secret123"})
    assert resp.status_code == 200
    masked = resp.json()["llm"]["openai_compatible_api_key"]
    assert masked == "***9999"
    assert "supersecret" not in resp.text

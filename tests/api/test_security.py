"""
Security tests for the query API: read-only Cypher guard, node-type
whitelist, neighborhood validation, and fail-closed API key auth.
"""
import asyncio
import types

import pytest
from fastapi.testclient import TestClient

import main
from graph_rag import ALLOWED_NODE_TYPES, GraphRAG, assert_read_only_cypher


# ── assert_read_only_cypher ──────────────────────────────────────────
@pytest.mark.parametrize(
    "cypher",
    [
        "CREATE (n:Foo)",
        "MERGE (n:Foo {id: 'x'})",
        "MATCH (n) DELETE n",
        "MATCH (n) DETACH DELETE n",
        "DETACH DELETE ALL",
        "MATCH (n) SET n.x = 1",
        "MATCH (n) REMOVE n.x",
        "DROP INDEX foo",
        "CALL db.labels()",
        "MATCH (n) RETURN n; MATCH (m) DELETE m",
    ],
)
def test_read_only_guard_rejects_writes(cypher):
    with pytest.raises(ValueError):
        assert_read_only_cypher(cypher)


def test_read_only_guard_is_case_insensitive():
    with pytest.raises(ValueError):
        assert_read_only_cypher("create (n:Foo)")


def test_read_only_guard_is_conservative_with_literals():
    # 'SET' inside a string literal is still rejected (conservative guard)
    with pytest.raises(ValueError):
        assert_read_only_cypher("match (n) where n.id = 'SET' return n")


def test_read_only_guard_accepts_plain_match():
    assert_read_only_cypher("MATCH (n:Standard) RETURN n.id, n.description LIMIT 10")


def test_read_only_guard_accepts_trailing_semicolon():
    assert_read_only_cypher("MATCH (n) RETURN n;")


# ── ALLOWED_NODE_TYPES / get_neighborhood validation ─────────────────
def test_allowed_node_types_contains_expected_labels():
    expected = {
        "Standard", "Clause", "Requirement", "Control", "Component",
        "TestCase", "Evidence", "Role", "Process", "Artifact",
    }
    assert expected <= ALLOWED_NODE_TYPES


def _stub_rag():
    calls = []

    def query(cypher, params=None):
        calls.append((cypher, params))
        return []

    rag = GraphRAG.__new__(GraphRAG)
    rag.graph = types.SimpleNamespace(query=query)
    return rag, calls


def test_get_neighborhood_rejects_invalid_node_type():
    rag, _ = _stub_rag()
    with pytest.raises(ValueError):
        asyncio.run(rag.get_neighborhood("Foo; DROP INDEX", "x", 2))
    with pytest.raises(ValueError):
        asyncio.run(rag.get_neighborhood("NotALabel", "x", 2))


def test_get_neighborhood_clamps_depth_and_uses_validated_label():
    rag, calls = _stub_rag()
    result = asyncio.run(rag.get_neighborhood("Standard", "ISO 9001", 99))
    assert result["depth"] == 5
    cypher, params = calls[0]
    assert ":Standard" in cypher
    assert "[*1..5]" in cypher
    assert params == {"node_id": "ISO 9001"}

    rag, calls = _stub_rag()
    result = asyncio.run(rag.get_neighborhood("Clause", "5.2", 0))
    assert result["depth"] == 1
    assert "[*1..1]" in calls[0][0]


# ── verify_key fail-closed ───────────────────────────────────────────
@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(main, "rag", None)

    class _StubRag:
        async def ping_neo4j(self):
            return True

    monkeypatch.setattr(main, "get_rag", lambda: _StubRag())
    return TestClient(main.app)


def test_models_forbidden_when_key_not_configured(client, monkeypatch):
    monkeypatch.setattr(main.settings, "api_key", "changeme")
    monkeypatch.setattr(main.settings, "insecure_dev_mode", False)
    resp = client.get("/v1/models", headers={"Authorization": "Bearer whatever"})
    assert resp.status_code == 403


def test_models_auth_flow(client, monkeypatch):
    monkeypatch.setattr(main.settings, "api_key", "secret123")
    monkeypatch.setattr(main.settings, "insecure_dev_mode", False)

    assert client.get("/v1/models").status_code == 401
    assert client.get("/v1/models", headers={"Authorization": "Bearer wrong"}).status_code == 401
    resp = client.get("/v1/models", headers={"Authorization": "Bearer secret123"})
    assert resp.status_code == 200
    assert resp.json()["object"] == "list"


def test_health_reachable_without_auth(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["neo4j"] is True

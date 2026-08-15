#!/usr/bin/env bash
#
# Run the full end-to-end suite against a live docker compose stack.
# The stack uses an offline mock LLM, so no external API keys are needed.
#
# Usage:
#   ./scripts/run_e2e.sh            # build + run + tear down
#   KEEP_UP=1 ./scripts/run_e2e.sh  # leave the stack running afterwards
#
set -euo pipefail
cd "$(dirname "$0")/.."

# Fresh, unique credentials per run (compose requires both to be set).
export NEO4J_PASSWORD="${NEO4J_PASSWORD:-e2e_neo4j_$(date +%s)}"
export QUERY_API_KEY="${QUERY_API_KEY:-e2e_api_key_$(date +%s)}"

# Publish on high, rarely-used host ports so e2e never collides with local
# services. Tests talk to containers by name on the compose network, so the
# host port choice does not affect the assertions.
export NEO4J_HTTP_PORT="${NEO4J_HTTP_PORT:-17474}"
export NEO4J_BOLT_PORT="${NEO4J_BOLT_PORT:-17687}"
export QDRANT_HTTP_PORT="${QDRANT_HTTP_PORT:-16333}"
export QDRANT_GRPC_PORT="${QDRANT_GRPC_PORT:-16334}"
export INGESTION_PORT="${INGESTION_PORT:-18001}"
export QUERY_API_PORT="${QUERY_API_PORT:-18000}"
export MCP_PORT="${MCP_PORT:-18002}"
export WEB_PORT="${WEB_PORT:-15173}"

COMPOSE=(docker compose -f docker-compose.yml -f tests/e2e/docker-compose.e2e.yml)

cleanup() {
  if [[ "${KEEP_UP:-0}" != "1" ]]; then
    echo ">> tearing down stack (volumes removed)"
    "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# Always start from a clean slate: a leftover Neo4j volume holding a previous
# password would make the fresh credentials fail auth.
echo ">> removing any previous stack + volumes"
"${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true

echo ">> building images (mock-llm, e2e-tests, api, ingestion, web)"
"${COMPOSE[@]}" build

echo ">> starting services"
"${COMPOSE[@]}" up -d neo4j qdrant mock-llm neo4j-init ingestion query-api mcp-server web

echo ">> running e2e suite (waits for services to become healthy)"
"${COMPOSE[@]}" run --rm e2e-tests

echo ">> e2e suite PASSED"

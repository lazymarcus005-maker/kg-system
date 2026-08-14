#!/usr/bin/env bash
set -e
# wait for neo4j then apply schema/seed
for i in $(seq 1 30); do
  if cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" "RETURN 1" >/dev/null 2>&1; then
    cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f /scripts/neo4j-init.cypher
    echo "[neo4j-init] schema + seed applied"
    exit 0
  fi
  echo "[neo4j-init] waiting for neo4j... ($i/30)"
  sleep 5
done
echo "[neo4j-init] ERROR: neo4j never became ready"
exit 1

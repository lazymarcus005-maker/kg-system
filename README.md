# KG System — Knowledge Graph for ISO Standards & Software Documents

PDF → Knowledge Graph → GraphRAG API → Any AI Harness

## Quickstart

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env — set LLM_PROVIDER and the relevant API key

# 2. Create input folder and drop PDFs
mkdir -p data/input
cp your_iso_standard.pdf data/input/

# 3. Start everything
docker compose up -d

# 4. Trigger ingestion
curl -X POST http://localhost:8001/ingest/watch

# 5. Query
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer changeme" \
  -d '{"messages": [{"role": "user", "content": "ISO 29148 clause 5.2 คืออะไร"}]}'
```

## Services

| Service | URL | Description |
|---------|-----|-------------|
| Neo4j Browser | http://localhost:7474 | Graph visualization |
| Ingestion API | http://localhost:8001/docs | Upload PDFs |
| Query API | http://localhost:8000/docs | GraphRAG endpoint |
| MCP Server | http://localhost:8002 | Claude Code / AI harness |

## LLM Provider

Set `LLM_PROVIDER` in `.env`:

| Value | Model used | Key needed |
|-------|-----------|------------|
| `openai` | gpt-4o | `OPENAI_API_KEY` |
| `anthropic` | claude-sonnet-4-6 | `ANTHROPIC_API_KEY` |
| `google` | gemini-1.5-pro | `GOOGLE_API_KEY` |
| `openrouter` | flexible (configurable) | `OPENROUTER_API_KEY` |
| `ollama` | llama3.2 (local) | none |

### OpenRouter

OpenRouter is an API aggregator supporting 200+ models (OpenAI, Anthropic, Google, etc.).

```bash
# Get key: https://openrouter.ai
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4o  # or other model: anthropic/claude-3.5-sonnet, google/gemini-2.0-flash, etc.
LLM_PROVIDER=openrouter
```

Popular OpenRouter models:
- `openai/gpt-4o` - OpenAI's GPT-4o
- `anthropic/claude-3.5-sonnet` - Claude 3.5 Sonnet
- `google/gemini-2.0-flash` - Gemini 2.0 Flash
- `meta-llama/llama-3.1-405b` - Llama 3.1 405B

## Embedding Provider

Embeddings are **independent** from LLM provider. Set `EMBEDDING_PROVIDER` in `.env`:

| Provider | Model | API Key | Cost |
|----------|-------|---------|------|
| `openai` | text-embedding-3-small | `OPENAI_API_KEY` | $0.02 per 1M tokens |
| `google` | text-embedding-004 | `GOOGLE_API_KEY` | $1 per 1M tokens |
| `huggingface` | all-MiniLM-L6-v2 (local) | none | Free ✅ |

```bash
# High quality (recommended)
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
OPENAI_API_KEY=sk-...

# Budget-friendly (local, offline)
EMBEDDING_PROVIDER=huggingface
EMBEDDING_MODEL=all-MiniLM-L6-v2

# Google embeddings
EMBEDDING_PROVIDER=google
EMBEDDING_MODEL=models/text-embedding-004
GOOGLE_API_KEY=AIza...
```

Popular HuggingFace models (no API key needed):
- `all-MiniLM-L6-v2` - Fast, 384 dimensions
- `all-mpnet-base-v2` - High quality, 768 dimensions
- `intfloat/e5-base` - Better semantic, 768 dimensions

## Integrate with AI Harnesses

### Claude Code (.claude/mcp.json)
```json
{
  "mcpServers": {
    "knowledge-graph": {
      "type": "url",
      "url": "http://localhost:8002/sse",
      "headers": { "Authorization": "Bearer changeme" }
    }
  }
}
```

### OpenAI-compatible (Codex / OpenCode / Continue.dev)
```json
{
  "baseURL": "http://localhost:8000/v1",
  "apiKey": "changeme",
  "model": "kg-graphrag"
}
```

### LangChain (custom integration)
```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="http://localhost:8000/v1",
    api_key="changeme",
    model="kg-graphrag",
)
```

### Gemini / Google AI Studio (via OpenAI-compat proxy)
Point `OPENAI_API_BASE` to `http://localhost:8000/v1`

## Ingestion API

```bash
# Upload a single PDF
curl -X POST http://localhost:8001/ingest \
  -F "file=@iso_29148.pdf" \
  -F "source=ISO" \
  -F "doc_type=standard"

# Watch input folder (pick up all PDFs in data/input/)
curl -X POST http://localhost:8001/ingest/watch

# Check job status
curl http://localhost:8001/jobs/{job_id}
```

## Query Examples

```bash
BASE="http://localhost:8000"
AUTH="Authorization: Bearer changeme"

# Natural language → graph answer
curl -X POST $BASE/v1/chat/completions \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"AuthService ต้องปฏิบัติตาม ISO clause ไหนบ้าง"}]}'

# Get raw Cypher translation
curl -X POST $BASE/query/cypher \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"question": "requirements ที่ยังไม่มี test case"}'

# Explore graph neighborhood
curl -X POST $BASE/query/graph \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"node_type":"Component","node_id":"AuthService","depth":2}'
```

## Project Structure

```
kg-system/
├── docker-compose.yml
├── .env.example
├── data/
│   ├── input/          ← drop PDFs here
│   └── processed/      ← moved after ingestion
├── ingestion/
│   ├── main.py         ← ingestion API
│   ├── pipeline.py     ← PDF → Neo4j + Qdrant
│   ├── llm_factory.py  ← multi-provider LLM builder
│   └── config.py
├── api/
│   ├── main.py         ← OpenAI-compatible query API
│   ├── graph_rag.py    ← GraphRAG core
│   ├── mcp_server.py   ← MCP server for Claude Code
│   └── config.py
└── scripts/
    └── neo4j-init.cypher ← schema + seed data
```

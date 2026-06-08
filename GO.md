# 🚀 KG System - How to Run Guide

คำแนะนำแบบละเอียดวิธีการ setup และ run ระบบ Knowledge Graph ทั้งหมด

---

## 📋 Prerequisites

### ✅ Minimum Requirements

- **Docker & Docker Compose** (recommended for simplest setup)
  - [Download Docker Desktop](https://www.docker.com/products/docker-desktop)
  
- **OR Local Development** (if running without Docker):
  - Python 3.10+
  - Node.js 18+ & npm
  - Neo4j 5.18+
  - Qdrant

### 🔑 API Keys (Choose at least one LLM provider)

- **OpenAI**: `OPENAI_API_KEY` (from https://platform.openai.com)
- **Anthropic**: `ANTHROPIC_API_KEY` (from https://console.anthropic.com)
- **Google**: `GOOGLE_API_KEY` (from Google AI Studio)
- **OpenRouter**: `OPENROUTER_API_KEY` (from https://openrouter.ai) - supports 200+ models
- **Ollama**: Free, local (no key needed)

---

## 🐳 Option 1: Docker Compose (Easiest)

### Step 1: Clone & Configure

```bash
cd D:\Workspaces\AIArea\kg-system

# Copy environment template
cp .env.example .env

# Edit .env with your API key
# nano .env
# OR edit with VS Code: code .env
```

**ตัวอย่าง .env file:**

```env
# Choose ONE LLM provider
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-... your-key-here

# OR use OpenRouter (supports 200+ models)
# LLM_PROVIDER=openrouter
# OPENROUTER_API_KEY=sk-or-...
# OPENROUTER_MODEL=openai/gpt-4o

# OR use Anthropic
# LLM_PROVIDER=anthropic
# ANTHROPIC_API_KEY=sk-ant-...

# Database credentials
NEO4J_USER=neo4j
NEO4J_PASSWORD=changeme123

# Query API key
QUERY_API_KEY=changeme

# Ingestion config
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
EXTRACT_ENTITIES=true
```

### Step 2: Prepare Data

```bash
# Create input folder
mkdir -p data/input

# Copy PDFs here
cp /path/to/your/pdf.pdf data/input/

# Verify
ls -la data/input/
```

### Step 3: Start All Services

```bash
# Start all services (Neo4j + Qdrant + API + Ingestion + Web)
docker-compose up -d

# Watch logs
docker-compose logs -f

# Check status
docker-compose ps
```

**คำว่า `-d` = detached mode (run in background)**

Expected output:
```
STATUS         PORTS
Running        0.0.0.0:7474->7474/tcp  (Neo4j)
Running        0.0.0.0:6333->6333/tcp  (Qdrant)
Running        0.0.0.0:8000->8000/tcp  (Query API)
Running        0.0.0.0:8001->8001/tcp  (Ingestion API)
Running        0.0.0.0:5173->5173/tcp  (Web UI)
```

### Step 4: Verify Services are Running

```bash
# Check Neo4j
curl http://localhost:7474

# Check Qdrant
curl http://localhost:6333/health

# Check API
curl http://localhost:8000/health

# Check Ingestion
curl http://localhost:8001/health
```

### Step 5: Start Ingestion

```bash
# Watch input folder for PDFs and auto-ingest
curl -X POST http://localhost:8001/ingest/watch

# OR upload specific PDF
curl -X POST http://localhost:8001/ingest \
  -F "file=@data/input/your_file.pdf" \
  -F "source=ISO" \
  -F "doc_type=standard"
```

### Step 6: Test Query

```bash
# Test GraphRAG query
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer changeme" \
  -d '{
    "messages": [
      {"role": "user", "content": "What are the main requirements?"}
    ]
  }'
```

### Step 7: Access Web UI

```
🌐 http://localhost:5173
```

**Pages available:**
- Dashboard - System overview
- Documents - PDF management
- Graph Explorer - Visualize graph
- Entity Management - Review entities
- Relation Review - Approve relations
- Ask / Chat - Test queries
- Settings - Configure system
- ... (7 more pages)

---

## 💻 Option 2: Local Development (Without Docker)

### Step 1: Backend Setup

#### 1.1 Start Databases

```bash
# Neo4j (requires local installation)
# https://neo4j.com/download/
neo4j start

# Qdrant (run in Docker only)
docker run -p 6333:6333 qdrant/qdrant:v1.9.2
```

#### 1.2 Python Environment

```bash
# Create virtual environment
python -m venv venv

# Activate
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r ingestion/requirements.txt
pip install -r api/requirements.txt
```

#### 1.3 Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

#### 1.4 Start Ingestion Service

```bash
cd ingestion
python main.py
# Runs on http://localhost:8001
```

#### 1.5 Start Query API (in new terminal)

```bash
cd api
python main.py
# Runs on http://localhost:8000
```

### Step 2: Frontend Setup

```bash
cd web

# Install dependencies
npm install

# Start development server
npm run dev
# Runs on http://localhost:5173
```

### Step 3: Access Everything

- **Web UI**: http://localhost:5173
- **Query API**: http://localhost:8000/docs
- **Ingestion API**: http://localhost:8001/docs
- **Neo4j Browser**: http://localhost:7474
- **Qdrant Dashboard**: http://localhost:6333/dashboard

---

## 📊 Service Access

| Service | URL | Purpose |
|---------|-----|---------|
| **Web UI** | http://localhost:5173 | 🎨 Main control panel |
| **Query API** | http://localhost:8000/docs | 📖 GraphRAG queries |
| **Ingestion API** | http://localhost:8001/docs | 📤 Upload PDFs |
| **Neo4j Browser** | http://localhost:7474 | 🌐 Graph visualization |
| **Qdrant Dashboard** | http://localhost:6333/dashboard | 📊 Vector DB |
| **MCP Server** | http://localhost:8002 | 🤖 Claude Code integration |

---

## 🔄 Embedding Provider Quick Switch

### OpenAI Embeddings (Recommended)

```bash
# .env
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
OPENAI_API_KEY=sk-...

# Restart
docker-compose restart ingestion query-api
```

### HuggingFace Embeddings (Local, Free)

```bash
# .env
EMBEDDING_PROVIDER=huggingface
EMBEDDING_MODEL=all-MiniLM-L6-v2
# No API key needed!

# Restart
docker-compose restart ingestion query-api
```

### Google Embeddings

```bash
# .env
EMBEDDING_PROVIDER=google
EMBEDDING_MODEL=models/text-embedding-004
GOOGLE_API_KEY=AIza...

# Restart
docker-compose restart ingestion query-api
```

---

## 🔄 LLM Provider Quick Switch

### OpenRouter (200+ models)

```bash
# Edit .env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-your-key-here
OPENROUTER_MODEL=openai/gpt-4o

# Popular models:
# - openai/gpt-4o
# - anthropic/claude-3.5-sonnet
# - google/gemini-2.0-flash
# - meta-llama/llama-3.1-405b

# Restart services
docker-compose restart ingestion query-api
```

### Anthropic Claude

```bash
# Edit .env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Restart services
docker-compose restart ingestion query-api
```

### Local Ollama

```bash
# Edit .env
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3.2

# Make sure Ollama is running:
docker run -d -p 11434:11434 ollama/ollama

# Restart services
docker-compose restart ingestion query-api
```

---

## 🔧 Common Tasks

### Upload PDF Documents

**Via Web UI:**
1. Go to http://localhost:5173
2. Click **Documents / Ingestion**
3. Upload PDF files

**Via API:**
```bash
curl -X POST http://localhost:8001/ingest \
  -F "file=@document.pdf" \
  -F "source=MySource" \
  -F "doc_type=standard"
```

**Watch folder (auto-ingest):**
```bash
curl -X POST http://localhost:8001/ingest/watch
```

### Query the Knowledge Graph

**Via Web UI:**
1. Go to http://localhost:5173
2. Click **Ask / Chat Playground**
3. Type your question

**Via API:**
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer changeme" \
  -d '{
    "model": "kg-graphrag",
    "messages": [
      {"role": "user", "content": "Your question here"}
    ]
  }'
```

### View Graph in Browser

**Neo4j Browser:**
```
URL: http://localhost:7474
Username: neo4j
Password: (from .env NEO4J_PASSWORD)
```

**Graph Explorer (in Web UI):**
1. Go to http://localhost:5173
2. Click **Graph Explorer**

### Review Extracted Data

**In Web UI:**
1. **Entity Management** - View all extracted entities
2. **Relation Review** - Approve/reject relations
3. **Audit Log** - See ingestion history

### Monitor System Health

**In Web UI:**
1. Go to **Dashboard** - See overall health
2. **API / MCP Monitor** - Check service status
3. **Retrieval Debug** - Test query pipeline

### Check Logs

```bash
# Docker logs
docker-compose logs -f ingestion
docker-compose logs -f query-api
docker-compose logs -f web

# Or follow specific service
docker-compose logs -f query-api | grep ERROR
```

### Stop All Services

```bash
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

---

## ⚙️ Configuration

### Environment Variables (.env)

```bash
# LLM Provider (choose one)
LLM_PROVIDER=openai              # or: anthropic, google, openrouter, ollama
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4o   # or: anthropic/claude-3.5-sonnet, google/gemini-2.0-flash, etc.

# Embedding Provider (independent from LLM)
EMBEDDING_PROVIDER=openai        # or: google, huggingface
EMBEDDING_MODEL=text-embedding-3-small

# Database
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=changeme123
QDRANT_HOST=localhost
QDRANT_PORT=6333

# Ingestion
CHUNK_SIZE=1000                  # tokens per chunk
CHUNK_OVERLAP=200                # overlap between chunks
EXTRACT_ENTITIES=true

# API
QUERY_API_KEY=changeme           # Bearer token for auth
QUERY_API_PORT=8000

# Ollama (if using local LLM)
OLLAMA_BASE_URL=http://localhost:11434
```

### Web Settings

In Web UI, go to **Settings** to configure:
- ✅ LLM Provider & Model
- ✅ Embedding settings
- ✅ Ingestion parameters
- ✅ GraphRAG options
- ✅ Database connections
- ✅ API/MCP settings

---

## 🧪 Testing

### Test Ingestion Pipeline

```bash
# 1. Upload a test PDF
curl -X POST http://localhost:8001/ingest \
  -F "file=@test.pdf"

# 2. Get job status
curl http://localhost:8001/jobs/{job_id}

# 3. Query results
curl http://localhost:8000/query/entities
```

### Test Query API

```bash
# Simple question
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer changeme" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Check Cypher generation
curl -X POST http://localhost:8000/query/cypher \
  -H "Authorization: Bearer changeme" \
  -H "Content-Type: application/json" \
  -d '{"question": "What entities exist?"}'
```

### Test Web UI

```bash
# 1. Open browser
open http://localhost:5173

# 2. Navigate pages
# - Dashboard: Should show stats
# - Documents: Should list any ingested PDFs
# - Graph Explorer: Should show visualization
# - Ask/Chat: Should handle questions
# - Settings: Should have all options

# 3. Try uploading document
# - Go to Documents/Ingestion
# - Upload a PDF
# - Should appear in table
```

---

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Find what's using port 8000
lsof -i :8000              # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Or use a different port in docker-compose.yml
# Change: "8000:8000" to "8001:8000"
```

### Neo4j Connection Failed

```bash
# Check if Neo4j is running
docker-compose logs neo4j | tail -20

# Verify connection
curl -u neo4j:changeme123 bolt://localhost:7687

# Reset Neo4j (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d neo4j
```

### Out of Memory

```bash
# Increase Docker resources
# Docker Desktop → Preferences → Resources
# Set: Memory to 4GB+, CPU to 4+

# Or adjust Neo4j heap size in docker-compose.yml
# NEO4J_dbms_memory_heap_max__size: 2G
```

### Ingestion Slow/Hanging

```bash
# Check logs
docker-compose logs ingestion

# Common causes:
# - API key invalid → check .env
# - LLM provider down → try ollama
# - Large PDF → increase timeout

# Restart ingestion service
docker-compose restart ingestion
```

### Web UI Not Loading

```bash
# Check if npm server is running
curl http://localhost:5173

# Check logs
docker-compose logs web

# Rebuild
cd web
npm run build
```

### API Returns 401 Unauthorized

```bash
# Check API key
# In request: Authorization: Bearer YOUR_KEY
# Should match: QUERY_API_KEY in .env

# Update if needed
# .env: QUERY_API_KEY=your-new-key
# Restart: docker-compose restart query-api
```

---

## 📝 Example Workflow

### Scenario: Ingest ISO 29148 and Query It

```bash
# 1. Prepare
cp .env.example .env
# Edit .env → add OPENAI_API_KEY
mkdir -p data/input

# 2. Add PDF
cp iso_29148.pdf data/input/

# 3. Start system
docker-compose up -d

# 4. Wait for services (30 seconds)
sleep 30

# 5. Ingest
curl -X POST http://localhost:8001/ingest/watch

# 6. Wait for extraction (2-5 minutes)
# Check: curl http://localhost:8001/jobs

# 7. Open Web UI
# http://localhost:5173

# 8. View results
# - Dashboard → see stats
# - Documents → see uploaded file
# - Entity Management → see extracted entities
# - Graph Explorer → see graph structure

# 9. Query
# Ask / Chat → "What are the main requirements in clause 5?"

# 10. Review quality
# Relation Review → approve/reject extracted relations
```

---

## 🔌 Integration with Other Tools

### Claude Code / Cursor

```json
// .claude/mcp.json
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

### OpenAI API Wrapper

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="changeme"
)

response = client.chat.completions.create(
    model="kg-graphrag",
    messages=[{"role": "user", "content": "Your question"}]
)
print(response.choices[0].message.content)
```

### LangChain

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="http://localhost:8000/v1",
    api_key="changeme",
    model="kg-graphrag"
)

result = llm.invoke("What are the main components?")
print(result.content)
```

---

## 📈 Next Steps

After running the system:

1. **Upload Documents** (Documents / Ingestion page)
   - PDFs will be processed
   - Entities & relations extracted
   
2. **Review Quality** (Entity Management & Relation Review)
   - Fix incorrect entities
   - Approve/reject relations

3. **Query Knowledge** (Ask / Chat page)
   - Ask natural language questions
   - View answers with sources

4. **Monitor & Debug** (API Monitor & Retrieval Debug)
   - Check system health
   - Debug query pipeline
   - View logs

5. **Configure** (Settings page)
   - Adjust LLM parameters
   - Change chunk sizes
   - Configure GraphRAG

---

## 📞 Quick Reference

```bash
# Start everything
docker-compose up -d

# Watch logs
docker-compose logs -f

# Stop everything
docker-compose down

# Reset data
docker-compose down -v

# Rebuild images
docker-compose build

# Check specific service
docker-compose logs query-api

# Execute command in container
docker-compose exec query-api bash
```

---

## ✅ Checklist

- [ ] Prerequisites installed (Docker or Python/Node.js)
- [ ] .env file created with API key
- [ ] data/input folder created
- [ ] Services started (docker-compose up -d)
- [ ] Services verified (curl checks)
- [ ] PDF uploaded
- [ ] Ingestion started (ingest/watch)
- [ ] Web UI accessible (http://localhost:5173)
- [ ] Query tested
- [ ] Results viewed

---

## 🎯 Troubleshooting Decision Tree

```
Problem: Can't access Web UI?
├─ Check port: curl http://localhost:5173
├─ Check Docker: docker-compose ps
├─ Check logs: docker-compose logs web
└─ Rebuild: docker-compose up -d web --build

Problem: Query returns error?
├─ Check API key: .env has valid key?
├─ Check service: curl http://localhost:8000/health
├─ Check logs: docker-compose logs query-api
├─ Check LLM: Valid OPENAI_API_KEY or ANTHROPIC_API_KEY?

Problem: Ingestion stuck?
├─ Check logs: docker-compose logs ingestion
├─ Check Neo4j: curl -u neo4j:password localhost:7474
├─ Check Qdrant: curl http://localhost:6333/health
├─ Restart: docker-compose restart ingestion

Problem: No entities extracted?
├─ Check EXTRACT_ENTITIES=true in .env
├─ Check LLM working: curl query API
├─ Check Neo4j schema: http://localhost:7474
├─ Check logs: docker-compose logs ingestion
```

---

**Ready to run? Start with:** 
```bash
docker-compose up -d
curl -X POST http://localhost:8001/ingest/watch
open http://localhost:5173
```

**ติดปัญหา? Check logs:**
```bash
docker-compose logs -f
```

Happy Knowledge Graphing! 🚀

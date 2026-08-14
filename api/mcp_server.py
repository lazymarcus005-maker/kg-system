"""
MCP Server (Model Context Protocol) — SSE transport.
Exposes the Knowledge Graph as MCP tools for:
  - Claude Code (.claude/mcp.json)
  - Any MCP-compatible AI harness
"""
import json
import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    query_api_url: str = "http://query-api:8000"
    api_key: str = "changeme"
    cors_origins: str = "http://localhost:5173"


settings = Settings()
app = FastAPI(title="KG MCP Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── MCP Tool definitions ──────────────────────────────────────────────
MCP_TOOLS = [
    {
        "name": "kg_query",
        "description": (
            "Query the Knowledge Graph using natural language. "
            "Returns answers grounded in ISO standards, software requirements, "
            "architecture decisions, and traceability data. "
            "Use this when asked about standards compliance, requirements, "
            "component responsibilities, or document traceability."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "Natural language question about the knowledge base",
                }
            },
            "required": ["question"],
        },
    },
    {
        "name": "kg_cypher",
        "description": (
            "Execute a natural language query and get back the raw Cypher query "
            "and graph data. Use when you need structured graph data or want to "
            "inspect relationships between nodes directly."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "What to find in the graph",
                }
            },
            "required": ["question"],
        },
    },
    {
        "name": "kg_neighborhood",
        "description": (
            "Get the graph neighborhood (connected nodes and relationships) "
            "for a specific entity. Use to explore how a component, requirement, "
            "or clause connects to other entities."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node_type": {
                    "type": "string",
                    "description": "Node label e.g. Component, Requirement, Clause, Standard",
                },
                "node_id": {
                    "type": "string",
                    "description": "The id or name of the node",
                },
                "depth": {
                    "type": "integer",
                    "description": "How many hops to traverse (default 2)",
                    "default": 2,
                },
            },
            "required": ["node_type", "node_id"],
        },
    },
]


async def call_api(path: str, payload: dict) -> dict:
    headers = {"Authorization": f"Bearer {settings.api_key}"}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(f"{settings.query_api_url}{path}", json=payload, headers=headers)
        r.raise_for_status()
        return r.json()


async def dispatch_tool(name: str, arguments: dict) -> str:
    if name == "kg_query":
        result = await call_api(
            "/v1/chat/completions",
            {"messages": [{"role": "user", "content": arguments["question"]}], "model": "kg-graphrag"},
        )
        answer = result["choices"][0]["message"]["content"]
        sources = result.get("kg_sources", [])
        return json.dumps({"answer": answer, "sources": sources}, ensure_ascii=False)

    if name == "kg_cypher":
        result = await call_api("/query/cypher", {"question": arguments["question"]})
        return json.dumps(result, ensure_ascii=False)

    if name == "kg_neighborhood":
        result = await call_api(
            "/query/graph",
            {
                "node_type": arguments["node_type"],
                "node_id": arguments["node_id"],
                "depth": arguments.get("depth", 2),
            },
        )
        return json.dumps(result, ensure_ascii=False)

    return json.dumps({"error": f"Unknown tool: {name}"})


# ── MCP SSE endpoint ──────────────────────────────────────────────────
@app.get("/sse")
async def mcp_sse(request: Request):
    """SSE endpoint for MCP protocol (Claude Code, Cursor, etc.)"""

    async def event_generator():
        # 1. Send tool list on connect
        yield {
            "event": "tools",
            "data": json.dumps({"tools": MCP_TOOLS}),
        }

        # 2. Keep connection alive / process requests
        async for message in request.app.state.message_queue:
            if await request.is_disconnected():
                break
            yield message

    return EventSourceResponse(event_generator())


# ── MCP HTTP POST endpoint (for non-SSE harnesses) ───────────────────
class ToolCall(BaseModel):
    name: str
    arguments: dict = {}


@app.post("/tools/call")
async def call_tool(tool_call: ToolCall):
    result = await dispatch_tool(tool_call.name, tool_call.arguments)
    return {"content": [{"type": "text", "text": result}]}


@app.get("/tools/list")
async def list_tools():
    return {"tools": MCP_TOOLS}


@app.get("/health")
async def health():
    return {"status": "ok", "tools": len(MCP_TOOLS)}

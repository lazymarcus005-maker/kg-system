"""
Offline OpenAI-compatible mock used by the e2e suite.

Implements just enough of the chat + embeddings API for the stack to run
without any external provider:
  - /v1/chat/completions : returns Cypher for the cypher-generation prompt,
                           a canned answer otherwise.
  - /v1/embeddings       : deterministic fixed-dimension vectors.
"""
import hashlib
import os
import time

from fastapi import FastAPI
from pydantic import BaseModel

EMBED_DIM = int(os.environ.get("MOCK_EMBED_DIM", "1536"))
CYPHER = "MATCH (n) RETURN count(n) AS c"
ANSWER = "Mock e2e answer grounded in the knowledge graph (ISO 29148, Clause 5.2)."

app = FastAPI(title="KG e2e mock LLM")


class ChatRequest(BaseModel):
    model: str = ""
    messages: list = []


class EmbedRequest(BaseModel):
    model: str = ""
    input: object = ""


async def _chat(req: ChatRequest):
    prompt = " ".join(
        m.get("content", "") for m in req.messages if isinstance(m, dict)
    )
    content = CYPHER if "raw Cypher" in prompt else ANSWER
    return {
        "id": "mock-chat",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": req.model or "mock-model",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
    }


async def _embed(req: EmbedRequest):
    inputs = req.input if isinstance(req.input, list) else [req.input]
    data = []
    for i, text in enumerate(inputs):
        vec = [0.0] * EMBED_DIM
        digest = hashlib.sha256(str(text).encode()).digest()
        vec[int.from_bytes(digest[:4], "big") % EMBED_DIM] = 1.0
        vec[(i + 1) % EMBED_DIM] = 0.5
        data.append({"object": "embedding", "index": i, "embedding": vec})
    return {
        "object": "list",
        "data": data,
        "model": req.model or "mock-embed",
        "usage": {"prompt_tokens": 1, "total_tokens": 1},
    }


app.add_api_route("/v1/chat/completions", _chat, methods=["POST"])
app.add_api_route("/chat/completions", _chat, methods=["POST"])
app.add_api_route("/v1/embeddings", _embed, methods=["POST"])
app.add_api_route("/embeddings", _embed, methods=["POST"])


@app.get("/health")
async def health():
    return {"status": "ok", "embed_dim": EMBED_DIM}

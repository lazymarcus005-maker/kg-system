# OpenRouter Integration Guide

OpenRouter is an API aggregator that provides access to 200+ LLM models from different providers. Perfect for:
- ✅ Cost optimization (compare prices across models)
- ✅ Model flexibility (switch models without changing code)
- ✅ Rate limit management (distribute across providers)
- ✅ Fallback support (automatic provider switching)

---

## 🚀 Setup

### Step 1: Get API Key

1. Go to https://openrouter.ai
2. Sign up and create account
3. Go to **Dashboard → API Keys**
4. Copy your API key (starts with `sk-or-`)

### Step 2: Configure KG System

**Edit `.env`:**

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-your-api-key-here
OPENROUTER_MODEL=openai/gpt-4o
```

### Step 3: Restart Services

```bash
docker-compose restart ingestion query-api
```

---

## 📊 Available Models

### Recommended (Best Quality/Speed Balance)

```
openai/gpt-4o                    # Fast, multimodal, 128K context
anthropic/claude-3.5-sonnet      # Very capable, 200K context
google/gemini-2.0-flash          # Fast reasoning, 1M context
```

### Budget-Friendly

```
openai/gpt-4-turbo              # Cost-effective GPT-4
mistral/mistral-large           # Good quality, very cheap
qwen/qwen-2.5-72b               # Fast, affordable
```

### High-Performance

```
anthropic/claude-3-opus         # Most capable Claude
openai/gpt-4-turbo-preview      # Advanced reasoning
meta-llama/llama-3.1-405b       # Powerful open-source
```

### Local/Private

```
meta-llama/llama-3.1-8b         # Small, fast
meta-llama/llama-3.1-70b        # Balanced
mistral/mistral-7b              # Efficient
```

---

## 💰 Pricing

OpenRouter shows **real-time pricing** for each model:

```bash
# Check pricing at: https://openrouter.ai/models

Example (as of Jan 2025):
- gpt-4o:                 $3/$6 per 1M tokens
- claude-3.5-sonnet:      $3/$15 per 1M tokens
- gemini-2.0-flash:       $0.075/$0.3 per 1M tokens
- mistral-large:          $0.27/$0.81 per 1M tokens
```

---

## 🔧 Configuration Examples

### High Quality (Recommended for Production)

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

**Pros:**
- Very high quality responses
- Strong reasoning capabilities
- Large context window (200K)

**Cons:**
- More expensive per token
- Slightly slower

### Cost Optimized

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=google/gemini-2.0-flash
```

**Pros:**
- Cheapest high-quality option
- Very fast
- Huge context (1M)

**Cons:**
- Slightly less capable than GPT-4o for complex tasks

### Balanced

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4o
```

**Pros:**
- Excellent quality/price ratio
- Fast and reliable
- Multimodal support

**Cons:**
- Mid-tier price point

---

## 📈 Monitoring & Usage

### Check Usage

1. Go to https://openrouter.ai/activity
2. View:
   - Requests count
   - Token usage
   - Cost by model
   - Error rates

### Set Budget Limits

1. Dashboard → Settings → Budget
2. Set monthly limit
3. Get alerts at thresholds

### API Response Headers

OpenRouter provides usage info in response headers:

```json
{
  "x-ratelimit-limit-requests": 200,
  "x-ratelimit-limit-tokens": 2000000,
  "x-ratelimit-remaining-requests": 199,
  "x-ratelimit-remaining-tokens": 1999500
}
```

---

## 🆘 Troubleshooting

### "401 Unauthorized"

```bash
# Check API key format
# Must start with: sk-or-

# Verify in .env
echo $OPENROUTER_API_KEY

# Test API key directly
curl "https://openrouter.ai/api/v1/models" \
  -H "Authorization: Bearer sk-or-YOUR-KEY"
```

### "Model not found"

```bash
# View available models
curl "https://openrouter.ai/api/v1/models" \
  -H "Authorization: Bearer sk-or-YOUR-KEY" | jq

# Check exact model name in OPENROUTER_MODEL
# Format: provider/model-name
```

### Slow Responses

```bash
# OpenRouter automatically routes to best provider
# If slow, try faster model:
OPENROUTER_MODEL=google/gemini-2.0-flash
OPENROUTER_MODEL=mistral/mistral-large
```

### Rate Limited

```bash
# Check current usage: https://openrouter.ai/activity
# Wait or increase budget limits
# Or switch to local Ollama for unlimited requests
```

---

## 🔄 Comparing Models

### Quick Test

```bash
# Test with OpenRouter
curl -X POST "https://openrouter.ai/api/v1/chat/completions" \
  -H "Authorization: Bearer sk-or-YOUR-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [
      {"role": "user", "content": "What is GraphRAG?"}
    ]
  }'
```

### Within KG System

Test via Web UI:
1. Go to http://localhost:5173
2. **Settings** → Change LLM provider to OpenRouter
3. Set model in **Settings** → OPENROUTER_MODEL
4. Test in **Ask / Chat Playground**

---

## 🚀 Advanced: Cost Optimization

### Strategy 1: Route by Task Complexity

Simple tasks → cheaper model
Complex tasks → expensive model

```env
# For ingestion (simpler)
OPENROUTER_MODEL=mistral/mistral-large

# For complex queries (use Settings page)
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

### Strategy 2: Batch Processing

Process multiple documents with cheaper model:

```bash
LLM_PROVIDER=openrouter
OPENROUTER_MODEL=qwen/qwen-2.5-72b
# Run bulk ingestion
curl -X POST http://localhost:8001/ingest/watch

# Then review with expensive model for important queries
```

### Strategy 3: Monitor Usage

```bash
# Check pricing dashboard weekly
# Adjust models based on actual cost vs performance
curl https://openrouter.ai/activity
```

---

## 📚 Resources

- **OpenRouter Docs**: https://openrouter.ai/docs
- **Models List**: https://openrouter.ai/models
- **Pricing**: https://openrouter.ai/models (scroll down)
- **API Reference**: https://openrouter.ai/api/v1
- **Status Page**: https://status.openrouter.io

---

## 🎯 Recommended Setup

```env
# For most use cases
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4o

# OR budget-conscious
LLM_PROVIDER=openrouter
OPENROUTER_MODEL=google/gemini-2.0-flash

# OR highest quality
LLM_PROVIDER=openrouter
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

---

## ✨ Tips & Tricks

### 1. Use OpenRouter Headers for Analytics

```python
# In Python client
import openai

client = openai.OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="sk-or-YOUR-KEY"
)

response = client.chat.completions.create(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "Hi"}]
)

# Access usage info
print(response.usage)
```

### 2. Set Default Route

```bash
# OpenRouter can route to specific provider:
# https://openrouter.ai/docs#routing
# Set via HTTP header: "HTTP-Referer"
```

### 3. Automatic Fallback

```bash
# If primary model fails, OpenRouter switches provider
# Use: route_config in request
```

---

## ❓ FAQ

**Q: Can I use multiple models?**
A: Yes, toggle in Settings page or via API

**Q: What if my API key is compromised?**
A: Regenerate immediately in OpenRouter dashboard

**Q: Can I use OpenRouter offline?**
A: No, requires internet connection

**Q: Does KG System cache API responses?**
A: Currently no, can be added for cost savings

**Q: Which model is fastest?**
A: Google Gemini 2.0 Flash (~50ms latency)

**Q: Which model is cheapest?**
A: Qwen 2.5, Mistral Large (check current pricing)

---

**Happy querying!** 🚀

Switch to OpenRouter and enjoy access to 200+ models without changing your code!

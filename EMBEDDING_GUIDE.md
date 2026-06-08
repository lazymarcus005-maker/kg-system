# Embedding Configuration Guide

Embeddings are **independent** from LLM provider. You can mix and match:
- LLM: Anthropic Claude
- Embedding: OpenAI text-embedding-3-small

---

## 🎯 Quick Start

### Default (OpenAI)

```env
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
OPENAI_API_KEY=sk-...
```

### Budget (Local HuggingFace)

```env
EMBEDDING_PROVIDER=huggingface
EMBEDDING_MODEL=all-MiniLM-L6-v2
# No API key needed!
```

### High Quality

```env
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-large
OPENAI_API_KEY=sk-...
```

---

## 📊 Comparison

| Provider | Model | Cost | Speed | Quality | API Key |
|----------|-------|------|-------|---------|---------|
| **OpenAI** | text-embedding-3-small | $0.02/1M | ⚡⚡ | ⭐⭐⭐⭐⭐ | ✅ |
| **OpenAI** | text-embedding-3-large | $0.13/1M | ⚡ | ⭐⭐⭐⭐⭐ | ✅ |
| **Google** | text-embedding-004 | $1/1M | ⚡⚡⚡ | ⭐⭐⭐⭐ | ✅ |
| **HuggingFace** | all-MiniLM-L6-v2 | Free ✅ | ⚡⚡⚡⚡ | ⭐⭐⭐ | ❌ |
| **HuggingFace** | all-mpnet-base-v2 | Free ✅ | ⚡⚡ | ⭐⭐⭐⭐ | ❌ |

---

## 🔑 OpenAI Embeddings

### Models

```
text-embedding-3-small
  - 1536 dimensions
  - Fast & cheap
  - Recommended for production
  - $0.02 per 1M tokens

text-embedding-3-large
  - 3072 dimensions
  - Better quality, slower
  - $0.13 per 1M tokens
```

### Setup

```env
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small  # or text-embedding-3-large
OPENAI_API_KEY=sk-...
```

### Cost Estimation

```
For PDF processing:
- 1000 documents × 1000 words each
- ≈ 1M tokens to embed
- Cost: $0.02 per 1M tokens = $0.02 total
```

---

## 🌍 Google Embeddings

### Models

```
models/text-embedding-004
  - Fast & capable
  - $1 per 1M tokens
  - Free tier: 100 requests/minute
```

### Setup

```env
EMBEDDING_PROVIDER=google
EMBEDDING_MODEL=models/text-embedding-004
GOOGLE_API_KEY=AIza...
```

---

## 🏠 HuggingFace Embeddings (Local)

### Models (All Free!)

```
all-MiniLM-L6-v2
  - 384 dimensions
  - Fastest
  - Good for simple use cases
  - ✅ No API key

all-mpnet-base-v2
  - 768 dimensions
  - Better quality
  - Slower (but still fast)
  - ✅ No API key

intfloat/e5-base
  - 768 dimensions
  - Better semantic meaning
  - ✅ No API key

sentence-transformers/all-large-v2
  - 384 dimensions
  - High quality
  - ✅ No API key

paraphrase-multilingual-MiniLM-L12-v2
  - 384 dimensions
  - Multilingual support
  - ✅ No API key
```

### Setup

```env
EMBEDDING_PROVIDER=huggingface
EMBEDDING_MODEL=all-MiniLM-L6-v2
# That's it! No API key needed
```

### Advantages

- ✅ **Free** - No API costs
- ✅ **Private** - Runs locally, no data sent anywhere
- ✅ **Offline** - Works without internet
- ✅ **Fast** - Local processing
- ✅ **No quotas** - Unlimited usage

### Disadvantages

- ❌ Lower quality than OpenAI
- ❌ Uses RAM/CPU (~2GB for all-MiniLM)
- ❌ Slower embedding generation

---

## 📏 Understanding Dimensions

Embedding dimensions = vector size = search quality:

```
384 dimensions  → faster, less memory, lower quality
768 dimensions  → balanced
1536 dimensions → better quality, more memory
3072 dimensions → highest quality, most memory
```

For most use cases, **1536 is sweet spot** ⚡

---

## 💡 Recommendations

### For Production (Cloud)

```env
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
OPENAI_API_KEY=sk-...
```

**Why:**
- Cheapest OpenAI option
- High quality
- Fast
- Reliable

---

### For Local/Private

```env
EMBEDDING_PROVIDER=huggingface
EMBEDDING_MODEL=all-mpnet-base-v2
```

**Why:**
- Free
- Good quality
- Works offline
- Private

---

### For Large Scale

```env
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-large
```

**Why:**
- Best quality
- Better for complex queries
- Cost is still reasonable at scale

---

### For Cost Optimization

```env
EMBEDDING_PROVIDER=huggingface
EMBEDDING_MODEL=all-MiniLM-L6-v2
```

**Why:**
- Zero cost
- Acceptable quality for many tasks
- Good speed

---

## 🔄 Switching Embeddings

### Step 1: Update .env

```env
EMBEDDING_PROVIDER=huggingface
EMBEDDING_MODEL=all-MiniLM-L6-v2
```

### Step 2: Restart Services

```bash
docker-compose restart ingestion query-api
```

### Step 3: Re-ingest Documents (Optional)

New documents will use new embedding model.
For existing documents, you can:

```bash
# Option 1: Leave as-is (old embeddings still work)
# Option 2: Delete Qdrant data and re-ingest
docker-compose down -v  # ⚠️ Deletes all vector data
docker-compose up -d
```

---

## 🧮 Embedding Dimensions in Config

```env
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
# Auto-set to 1536 dimensions
```

If you want custom dimensions:
- HuggingFace: auto-detected (384 for all-MiniLM)
- OpenAI: 1536 for small, 3072 for large (fixed)
- Google: 768 (fixed)

---

## 🚀 Advanced: Mix LLM + Embedding

### Best Quality + Low Cost

```env
# LLM: Expensive but high quality
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Embedding: Cheap but good
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
```

**Cost:**
- LLM (gpt-4o): $15 per 1M tokens
- Embedding: $0.02 per 1M tokens
- **Total: Reasonable!**

---

### Budget Option

```env
# LLM: Cheap
LLM_PROVIDER=ollama
OLLAMA_MODEL=mistral

# Embedding: Free
EMBEDDING_PROVIDER=huggingface
EMBEDDING_MODEL=all-MiniLM-L6-v2
```

**Cost:** **FREE!** ✅

---

### High Quality

```env
# LLM: Best
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Embedding: Best
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-large
OPENAI_API_KEY=sk-...
```

**Cost:** ~$20 per 1M tokens (combined)

---

## 🔍 How to Choose

### Question 1: Do you have API budget?

- **YES** → Use OpenAI text-embedding-3-small
- **NO** → Use HuggingFace all-MiniLM-L6-v2

### Question 2: Is quality critical?

- **YES** → Use OpenAI text-embedding-3-large
- **NO** → Use text-embedding-3-small or HuggingFace

### Question 3: Do you need multilingual support?

- **YES** → Use HuggingFace paraphrase-multilingual-MiniLM
- **NO** → Any model

### Question 4: Is speed critical?

- **YES** → Use HuggingFace all-MiniLM-L6-v2
- **NO** → Any model

---

## 📊 Performance Comparison

```
Embedding 1000 documents (1M tokens):

OpenAI text-embedding-3-small:
  - Time: ~5 seconds (API calls)
  - Cost: $0.02
  - Quality: Excellent

HuggingFace all-MiniLM-L6-v2:
  - Time: ~30 seconds (local processing)
  - Cost: Free
  - Quality: Good
```

---

## ✅ Checklist

- [ ] Choose EMBEDDING_PROVIDER (openai / google / huggingface)
- [ ] Set EMBEDDING_MODEL
- [ ] Add API key if needed
- [ ] Restart services: `docker-compose restart ingestion query-api`
- [ ] Upload test PDF
- [ ] Verify embeddings stored in Qdrant

---

## 🆘 Troubleshooting

### "EMBEDDING_PROVIDER not found"

**Solution:** Add to .env:
```env
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
```

### "Embedding dimension mismatch"

**Problem:** Changed embedding model with existing data
**Solution:** 
```bash
# Delete old vector data
docker-compose down -v
docker-compose up -d
# Re-ingest documents
```

### "HuggingFace model download failed"

**Problem:** First time downloading large model
**Solution:** Wait, model downloads automatically (~400MB)
```bash
# Check logs
docker-compose logs ingestion
```

### "OpenAI API key invalid"

**Solution:**
```env
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...  # Must start with sk-
```

---

## 📚 Resources

- **OpenAI Embeddings**: https://platform.openai.com/docs/models/embeddings
- **HuggingFace Sentence Transformers**: https://huggingface.co/sentence-transformers
- **Google Embeddings**: https://ai.google.dev/models/text-embedding

---

**Summary:** Choose embedding provider based on your budget and quality needs. LLM and embedding are independent! 🚀

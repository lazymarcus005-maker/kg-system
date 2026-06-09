"""
LLM + Embeddings factory for Query API.
Supports: OpenAI, Anthropic (Claude), Google (Gemini), OpenRouter, OpenAI-Compatible, Ollama (local).
Switch via LLM_PROVIDER env var — no code changes needed.
"""
from config import Settings


def build_llm(settings: Settings):
    provider = settings.llm_provider.lower()

    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model="gpt-4o",
            api_key=settings.openai_api_key,
            temperature=0,
        )

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model="claude-sonnet-4-6",
            api_key=settings.anthropic_api_key,
            temperature=0,
            max_tokens=4096,
        )

    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model="gemini-1.5-pro",
            google_api_key=settings.google_api_key,
            temperature=0,
        )

    if provider == "openrouter":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=settings.openrouter_model,
            api_key=settings.openrouter_api_key,
            base_url="https://openrouter.ai/api/v1",
            temperature=0,
        )

    if provider == "openai_compatible":
        if not settings.openai_compatible_api_key:
            raise ValueError("OPENAI_COMPATIBLE_API_KEY required for openai_compatible provider")
        if not settings.openai_compatible_base_url:
            raise ValueError("OPENAI_COMPATIBLE_BASE_URL required for openai_compatible provider")
        model = settings.openai_compatible_model or "qwen3.6-35b-a3b-fp8[1m]"
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model,
            api_key=settings.openai_compatible_api_key,
            base_url=settings.openai_compatible_base_url,
            temperature=0,
        )

    if provider == "ollama":
        from langchain_ollama import ChatOllama
        return ChatOllama(
            model=settings.ollama_model,
            base_url=settings.ollama_base_url,
            temperature=0,
        )

    raise ValueError(f"Unknown LLM_PROVIDER: {provider}. Use: openai|anthropic|google|openrouter|openai_compatible|ollama")


def build_embeddings(settings: Settings):
    """Build embeddings provider based on EMBEDDING_PROVIDER setting."""
    provider = settings.embedding_provider.lower()

    if provider == "openai":
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY required for openai embedding provider")
        from langchain_openai import OpenAIEmbeddings
        return OpenAIEmbeddings(
            model=settings.embedding_model,
            api_key=settings.openai_api_key,
        )

    if provider == "google":
        if not settings.google_api_key:
            raise ValueError("GOOGLE_API_KEY required for google embedding provider")
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        return GoogleGenerativeAIEmbeddings(
            model=settings.embedding_model,
            google_api_key=settings.google_api_key,
        )

    if provider == "huggingface":
        from langchain_community.embeddings import HuggingFaceEmbeddings
        return HuggingFaceEmbeddings(
            model_name=settings.embedding_model,
        )

    if provider == "openai_compatible":
        if not settings.openai_compatible_api_key:
            raise ValueError("OPENAI_COMPATIBLE_API_KEY required for openai_compatible embedding provider")
        base_url = (settings.openai_compatible_embeddings_base_url or settings.openai_compatible_base_url)
        if not base_url:
            raise ValueError("OPENAI_COMPATIBLE_BASE_URL or OPENAI_COMPATIBLE_EMBEDDINGS_BASE_URL required for openai_compatible embedding provider")
        from langchain_openai import OpenAIEmbeddings
        return OpenAIEmbeddings(
            model=settings.embedding_model,
            api_key=settings.openai_compatible_api_key,
            base_url=base_url,
        )

    if provider == "openrouter":
        if not settings.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY required for openrouter embedding provider")
        from langchain_openai import OpenAIEmbeddings
        return OpenAIEmbeddings(
            model=settings.embedding_model,
            api_key=settings.openrouter_api_key,
            base_url="https://openrouter.ai/api/v1",
        )

    raise ValueError(
        f"Unknown EMBEDDING_PROVIDER: {provider}. "
        f"Use: openai|google|huggingface|openai_compatible|openrouter"
    )

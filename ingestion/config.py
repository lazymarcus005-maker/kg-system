from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Neo4j
    neo4j_uri: str = "bolt://neo4j:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "changeme"

    # Qdrant
    qdrant_host: str = "qdrant"
    qdrant_port: int = 6333
    qdrant_collection: str = "kg_documents"

    # LLM selection
    llm_provider: str = "openai"   # openai | anthropic | google | openrouter | openai_compatible | ollama

    # Provider keys
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_api_key: str = ""
    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-4o"
    openai_compatible_api_key: str = ""
    openai_compatible_base_url: str = ""
    openai_compatible_model: str = ""
    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "llama3.2"

    # Embeddings (independent from LLM provider)
    embedding_provider: str = "openai"  # openai | google | huggingface | openai_compatible
    embedding_model: str = "text-embedding-3-small"
    embedding_dimension: int = 1536

    # Qdrant
    qdrant_vector_size: int = 1536  # must match EMBEDDING_MODEL (1536 for text-embedding-3-small); bge-m3=1024, text-embedding-ada-002=1536

    # Ingestion
    chunk_size: int = 1000
    chunk_overlap: int = 200
    extract_entities: bool = True

    # API
    api_key: str = "changeme"
    query_api_url: str = "http://query-api:8000"
    max_upload_mb: int = 50
    cors_origins: str = "http://localhost:5173"
    insecure_dev_mode: bool = False

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    neo4j_uri: str = "bolt://neo4j:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "changeme"

    qdrant_host: str = "qdrant"
    qdrant_port: int = 6333
    qdrant_collection: str = "kg_documents"

    llm_provider: str = "openai"
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_api_key: str = ""
    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-4o"
    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "llama3.2"

    # Embeddings (independent from LLM provider)
    embedding_provider: str = "openai"  # openai | google | huggingface
    embedding_model: str = "text-embedding-3-small"
    embedding_dimension: int = 1536

    chunk_size: int = 1000
    chunk_overlap: int = 200
    extract_entities: bool = True

    api_key: str = "changeme"
    query_api_url: str = "http://query-api:8000"

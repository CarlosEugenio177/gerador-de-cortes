from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "ClipForge AI Engine"

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")

    # Ollama AI
    OLLAMA_HOST: str = os.getenv("OLLAMA_HOST", "http://host.docker.internal:11434")

    # Hugging Face
    HF_TOKEN: str = os.getenv("HF_TOKEN", "")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()

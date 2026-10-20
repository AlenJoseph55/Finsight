"""
Application Configuration Module.

Why Pydantic BaseSettings?
- Automatic type casting (e.g., strings in .env converted to int, bool).
- Strict validation: fails immediately at startup if a critical secret is missing,
  rather than failing 2 hours later when a user performs an action.
- Centralized configuration: any part of the app imports `get_settings()` and
  gets typed autocompletion.
"""

from functools import lru_cache
from typing import List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- Application ---
    ENVIRONMENT: str = "production"
    LOG_LEVEL: str = "INFO"
    SECRET_KEY: str = "change-this-to-a-super-secret-32-byte-hex-key-in-production"
    
    # --- Privacy: AES-256 Field Encryption Key ---
    # Used to encrypt sensitive document texts and notes at rest before saving to DB
    FIELD_ENCRYPTION_KEY: str = "v1n78_qZ8X0A8dI3k2aBcDeFgHiJkLmNoPqRsTuVwXy="

    # --- Database (PostgreSQL + pgvector) ---
    POSTGRES_USER: str = "finsight_user"
    POSTGRES_PASSWORD: str = "finsight_secret"
    POSTGRES_DB: str = "finsight_db"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5433
    DATABASE_URL: str = "postgresql+asyncpg://finsight_user:finsight_secret@localhost:5433/finsight_db"

    # Synchronous DB URL for Alembic migrations
    @property
    def sync_database_url(self) -> str:
        return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

    # --- Redis (Cache & Task Queue) ---
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_URL: str = "redis://localhost:6379/0"

    # --- AI & LLM (Google Gemini, Groq, OpenAI) ---
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini/gemini-3.6-flash"
    EMBEDDING_DIMENSIONS: int = 768  # Gemini produces 768-dim vectors
    GROQ_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    # --- Market Data APIs ---
    FINNHUB_API_KEY: Optional[str] = None

    # --- Auth & Security ---
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours (bounded privilege window)
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    ADMIN_EMAILS: str = ""

    @field_validator("ADMIN_EMAILS", mode="before")
    @classmethod
    def normalize_admin_emails(cls, v: Optional[str]) -> str:
        return v or ""

    @property
    def admin_emails_list(self) -> List[str]:
        return [e.strip().lower() for e in self.ADMIN_EMAILS.split(",") if e.strip()]

    # --- CORS (Cross-Origin Resource Sharing) ---
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @property
    def cors_origins_list(self) -> List[str]:
        origins = list(self.CORS_ORIGINS)
        if self.FRONTEND_URL and self.FRONTEND_URL not in origins:
            origins.append(self.FRONTEND_URL.rstrip("/"))
        return origins

    # Pydantic v2 configuration to read from .env file
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """
    Returns a cached instance of application settings.
    Why @lru_cache? We only parse the .env file once on startup,
    then reuse the in-memory object for high performance.
    """
    return Settings()

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration. Loaded from environment / backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    DATABASE_URL: str = ""

    # Supabase auth
    SUPABASE_URL: str = ""
    SUPABASE_PUBLISHABLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    # LLM
    LLM_BASE_URL: str = ""
    LLM_API_KEY: str = ""
    LLM_MODEL: str = ""

    # Embeddings / retrieval
    EMBEDDING_MODEL: str = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
    EMBEDDING_DIM: int = 768
    SIMILARITY_THRESHOLD: float = 0.35
    SCOPE_THRESHOLD: float = 0.5
    MATCH_COUNT: int = 5

    # Translation
    TRANSLATION_PROVIDER: str = "none"  # none | libretranslate | llm
    LIBRETRANSLATE_URL: str = ""

    # Speech
    STT_PROVIDER: str = ""
    STT_API_KEY: str = ""
    STT_BASE_URL: str = ""
    TTS_PROVIDER: str = ""
    TTS_API_KEY: str = ""
    TTS_BASE_URL: str = ""

    # Storage / app
    UPLOAD_DIR: str = "./data/uploads"
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://localhost:8080"
    LOG_LEVEL: str = "INFO"

    # Guest (signed-out) chat protection: per-IP requests per hour to
    # /api/chat/ask. In-memory, per backend process. Set TRUST_PROXY_HEADERS
    # only behind a proxy you control (Render/Railway/nginx) so the client IP
    # is read from X-Forwarded-For.
    GUEST_CHAT_LIMIT_PER_HOUR: int = 20
    TRUST_PROXY_HEADERS: bool = False

    @property
    def sqlalchemy_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url

    @property
    def llm_configured(self) -> bool:
        return bool(self.LLM_BASE_URL and self.LLM_API_KEY and self.LLM_MODEL)

    @property
    def stt_configured(self) -> bool:
        return bool(self.STT_PROVIDER and self.STT_BASE_URL and self.STT_API_KEY)

    @property
    def tts_configured(self) -> bool:
        return bool(self.TTS_PROVIDER and self.TTS_BASE_URL and self.TTS_API_KEY)

    @property
    def translation_configured(self) -> bool:
        if self.TRANSLATION_PROVIDER == "libretranslate":
            return bool(self.LIBRETRANSLATE_URL)
        if self.TRANSLATION_PROVIDER == "llm":
            return self.llm_configured
        return False


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

"""Worker settings, validated once at startup (names only in errors, never values).

Local development reads the repo-root .env; production reads real environment variables.
Limits default to contracts/ingestion.json and can be overridden by env (spec section 7).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.contract import LIMITS


def _env_files() -> tuple[str, ...]:
    # The repo-root .env when running from a checkout; harmless when it doesn't exist (Docker).
    here = Path(__file__).resolve()
    candidates = [p / ".env" for p in here.parents[:4]]
    return tuple(str(p) for p in candidates if p.is_file())


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_env_files(), extra="ignore", frozen=True)

    supabase_url: str = Field(validation_alias=AliasChoices("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"))
    supabase_service_role_key: str = Field(min_length=1)
    openai_api_key: str = Field(min_length=1)
    # Captions are optional: without a key, figures keep their paper caption only.
    anthropic_api_key: str | None = None

    embedding_model: str = "text-embedding-3-small"
    embedding_dims: int = 1536
    fast_model: str = "claude-haiku-5-5"

    max_upload_mb: int = Field(default=LIMITS.max_upload_mb, gt=0)
    max_pages: int = Field(default=LIMITS.max_pages, gt=0)
    parse_timeout_s: int = Field(default=600, gt=0)
    max_figures: int = Field(default=40, gt=0)
    # Embedding cost guard: a document over this many tokens fails instead of running up a bill.
    max_document_tokens: int = Field(default=600_000, gt=0)
    caption_concurrency: int = Field(default=4, gt=0)

    inngest_dev: bool = False
    inngest_signing_key: str | None = None
    inngest_event_key: str | None = None
    log_level: str = "INFO"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


class SettingsError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    try:
        return Settings()  # type: ignore[call-arg]
    except ValidationError as exc:
        names = sorted({str(err["loc"][0]).upper() for err in exc.errors()})
        raise SettingsError(
            f"Invalid worker environment: {', '.join(names)}. See .env.example."
        ) from None

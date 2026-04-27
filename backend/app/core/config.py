"""Application settings loaded from environment / .env."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "DM Auto-DM Tool"
    api_prefix: str = "/api"
    debug: bool = True

    # Security
    secret_key: str = Field(
        default="change-me-please-use-a-strong-random-key-in-production-32+chars",
        description="JWT signing key. Override in production.",
    )
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    algorithm: str = "HS256"

    # Encryption key for IG session blobs (Fernet). 32 url-safe b64 bytes.
    fernet_key: str = Field(
        default="zmF8e7K0d5g2y3n4q5r6t7u8v9w0x1y2z3A4B5C6D7E=",
        description="Fernet key for encrypting Instagram session blobs.",
    )

    # Database
    database_url: str = f"sqlite:///{BASE_DIR / 'dm.db'}"

    # CORS
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    # Throttling defaults (overridable per-account)
    default_min_delay_sec: int = 45
    default_max_delay_sec: int = 120
    default_daily_cap: int = 50
    default_hourly_cap: int = 12

    # Scheduler
    scheduler_interval_sec: int = 15

    # First-run admin
    first_admin_email: str = "admin@example.com"
    first_admin_password: str = "changeme123"

    # Demo mode — when true, IG actions are simulated (no real network calls).
    demo_mode: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

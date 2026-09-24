from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.parse import quote_plus

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[1]
LISTENER_DIR = Path(__file__).resolve().parent


def load_environment() -> None:
    """Load an existing .env file without creating or replacing one."""

    for candidate in (
        PROJECT_ROOT / ".env",
        LISTENER_DIR / ".env",
        PROJECT_ROOT / "news_scrapper" / ".env",
        PROJECT_ROOT / "social_media_scrapper" / ".env",
        PROJECT_ROOT / "frontend" / ".env",
        PROJECT_ROOT / "admin_frontend_users" / ".env",
    ):
        if candidate.exists():
            load_dotenv(candidate, override=False)


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return int(value)


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return float(value)


def _required(name: str) -> str:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        raise ValueError(f"Missing required environment variable: {name}")
    return value.strip()


def _build_database_url() -> str:
    explicit_url = os.getenv("DATABASE_URL")
    if explicit_url:
        return _normalize_database_url(explicit_url)

    host = _required("POSTGRES_HOST")
    port = _required("POSTGRES_PORT")
    db = _required("POSTGRES_DB")
    user = _required("POSTGRES_USER")
    password = _required("POSTGRES_PASSWORD")

    return (
        "postgresql+psycopg://"
        f"{quote_plus(user)}:{quote_plus(password)}@"
        f"{host}:{port}/{quote_plus(db)}"
    )


def _normalize_database_url(database_url: str) -> str:
    database_url = database_url.strip()

    if database_url.startswith("postgres://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgres://")
    if database_url.startswith("postgresql://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgresql://")

    return database_url


@dataclass(frozen=True)
class ListenerSettings:
    kafka_bootstrap_servers: str
    kafka_topic: str
    kafka_group_id: str
    kafka_security_protocol: str
    kafka_sasl_mechanism: Optional[str]
    kafka_username: Optional[str]
    kafka_password: Optional[str]
    kafka_auto_offset_reset: str
    kafka_poll_timeout_seconds: float
    kafka_commit_on_processing_error: bool

    database_url: str
    database_echo: bool

    model_name: str
    similarity_threshold: float
    assumed_event_threshold: int
    matching_time_window_hours: int
    matching_candidate_limit: int
    nlp_max_length: int
    log_level: str


def get_settings() -> ListenerSettings:
    load_environment()

    return ListenerSettings(
        kafka_bootstrap_servers=_required("KAFKA_BOOTSTRAP_SERVERS"),
        kafka_topic=_required("KAFKA_TOPIC"),
        kafka_group_id=os.getenv("KAFKA_GROUP_ID", "event-listener").strip(),
        kafka_security_protocol=os.getenv("KAFKA_SECURITY_PROTOCOL", "PLAINTEXT"),
        kafka_sasl_mechanism=os.getenv("KAFKA_SASL_MECHANISM") or None,
        kafka_username=os.getenv("KAFKA_USERNAME") or None,
        kafka_password=os.getenv("KAFKA_PASSWORD") or None,
        kafka_auto_offset_reset=os.getenv("KAFKA_AUTO_OFFSET_RESET", "earliest"),
        kafka_poll_timeout_seconds=_env_float("KAFKA_POLL_TIMEOUT_SECONDS", 1.0),
        kafka_commit_on_processing_error=_env_bool(
            "KAFKA_COMMIT_ON_PROCESSING_ERROR",
            True,
        ),
        database_url=_build_database_url(),
        database_echo=_env_bool("DATABASE_ECHO", False),
        model_name=os.getenv("MODEL_NAME", "xlm-roberta-base"),
        similarity_threshold=_env_float("SIMILARITY_THRESHOLD", 0.78),
        assumed_event_threshold=_env_int("ASSUMED_EVENT_THRESHOLD", 5),
        matching_time_window_hours=_env_int("MATCHING_TIME_WINDOW_HOURS", 72),
        matching_candidate_limit=_env_int("MATCHING_CANDIDATE_LIMIT", 100),
        nlp_max_length=_env_int("NLP_MAX_LENGTH", 256),
        log_level=os.getenv("LISTENER_LOG_LEVEL", "INFO"),
    )

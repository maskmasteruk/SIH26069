from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from .config import ListenerSettings
from .models import Base


def create_database_engine(settings: ListenerSettings) -> Engine:
    connect_args = {}
    if settings.database_url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}

    return create_engine(
        settings.database_url,
        echo=settings.database_echo,
        future=True,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def initialize_database(engine: Engine) -> None:
    """Create missing listener storage while reusing the existing project tables."""

    if engine.dialect.name == "postgresql":
        with engine.begin() as conn:
            conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))

    Base.metadata.create_all(engine)

    if engine.dialect.name == "postgresql":
        _ensure_postgres_listener_migrations(engine)


def _ensure_postgres_listener_migrations(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30)
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_listener_events_type_location_time
                ON events(event_type, location_name, event_time)
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_listener_events_status_updated
                ON events(status, updated_at)
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_listener_source_external
                ON source_posts(platform, external_id)
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_listener_source_url
                ON source_posts(source_url)
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_listener_source_dedupe_key
                ON source_posts ((raw_data->>'dedupe_key'))
                """
            )
        )
        conn.execute(
            text(
                """
                ALTER TABLE events
                ADD COLUMN IF NOT EXISTS event_point POINT
                GENERATED ALWAYS AS (point(longitude, latitude)) STORED
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE events
                SET
                    latitude = COALESCE(latitude, 22.9734),
                    longitude = COALESCE(longitude, 78.6569)
                WHERE latitude IS NULL OR longitude IS NULL
                """
            )
        )
        conn.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'ck_events_latitude_required_india'
                    ) THEN
                        ALTER TABLE events
                        ADD CONSTRAINT ck_events_latitude_required_india
                        CHECK (latitude IS NOT NULL AND latitude BETWEEN 6.0 AND 37.6)
                        NOT VALID;
                    END IF;
                END
                $$;
                """
            )
        )
        conn.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'ck_events_longitude_required_india'
                    ) THEN
                        ALTER TABLE events
                        ADD CONSTRAINT ck_events_longitude_required_india
                        CHECK (longitude IS NOT NULL AND longitude BETWEEN 68.0 AND 97.5)
                        NOT VALID;
                    END IF;
                END
                $$;
                """
            )
        )
        conn.execute(text("ALTER TABLE events VALIDATE CONSTRAINT ck_events_latitude_required_india"))
        conn.execute(text("ALTER TABLE events VALIDATE CONSTRAINT ck_events_longitude_required_india"))
        conn.execute(text("ALTER TABLE events ALTER COLUMN latitude SET NOT NULL"))
        conn.execute(text("ALTER TABLE events ALTER COLUMN longitude SET NOT NULL"))
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_events_event_point
                ON events USING gist(event_point)
                """
            )
        )


@contextmanager
def session_scope(session_factory: sessionmaker[Session]) -> Iterator[Session]:
    session = session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

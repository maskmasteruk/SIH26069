from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import CHAR, JSON, TypeDecorator


class GUID(TypeDecorator):
    """Platform-independent UUID storage for PostgreSQL and unit-test SQLite."""

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return value if dialect.name == "postgresql" else str(value)
        parsed = uuid.UUID(str(value))
        return parsed if dialect.name == "postgresql" else str(parsed)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))


JSON_TYPE = JSON().with_variant(JSONB, "postgresql")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location_name: Mapped[str | None] = mapped_column(Text)
    event_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(30), default="unverified", nullable=False)
    verification_status: Mapped[str | None] = mapped_column(String(30))
    credibility_score: Mapped[float | None] = mapped_column(Numeric(5, 4))
    sentiment_score: Mapped[float | None] = mapped_column(Numeric(5, 4))
    ml_score: Mapped[float | None] = mapped_column(Numeric(5, 4))
    source_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    threshold_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    admin_notes: Mapped[str | None] = mapped_column(Text)
    verified_by: Mapped[uuid.UUID | None] = mapped_column(GUID())
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    source_posts: Mapped[list["SourcePost"]] = relationship(back_populates="event")
    embedding: Mapped["EventEmbedding | None"] = relationship(
        back_populates="event",
        cascade="all, delete-orphan",
        uselist=False,
    )


class SourcePost(Base):
    __tablename__ = "source_posts"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(),
        ForeignKey("events.id", ondelete="SET NULL"),
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    source_url: Mapped[str | None] = mapped_column(Text)
    external_id: Mapped[str | None] = mapped_column(Text)
    author_name: Mapped[str | None] = mapped_column(Text)
    content: Mapped[str | None] = mapped_column(Text)
    media_url: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    credibility_score: Mapped[float | None] = mapped_column(Numeric(5, 4))
    is_high_trust: Mapped[bool] = mapped_column(Boolean, default=False)
    raw_data: Mapped[dict | None] = mapped_column(JSON_TYPE)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    event: Mapped[Event | None] = relationship(back_populates="source_posts")


class EventSource(Base):
    __tablename__ = "event_sources"

    event_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("events.id", ondelete="CASCADE"),
        primary_key=True,
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("source_posts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    relation_type: Mapped[str] = mapped_column(String(50), default="related")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )


class EventMatch(Base):
    __tablename__ = "event_matches"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
    )
    matched_event_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
    )
    similarity_score: Mapped[float | None] = mapped_column(Numeric(5, 4))
    match_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("event_id", "matched_event_id", name="uq_event_match_pair"),
    )


class EventEmbedding(Base):
    __tablename__ = "event_embeddings"

    event_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("events.id", ondelete="CASCADE"),
        primary_key=True,
    )
    embedding: Mapped[list[float]] = mapped_column(JSON_TYPE, nullable=False)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    event: Mapped[Event] = relationship(back_populates="embedding")


Index("idx_listener_events_type_location_time", Event.event_type, Event.location_name, Event.event_time)
Index("idx_listener_events_status_updated", Event.status, Event.updated_at)
Index("idx_listener_source_external", SourcePost.platform, SourcePost.external_id)
Index("idx_listener_source_url", SourcePost.source_url)

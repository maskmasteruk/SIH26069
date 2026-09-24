from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, sessionmaker

from .config import ListenerSettings
from .database import session_scope
from .event_matcher import EventMatcher
from .ml_processor import EventMLProcessor, MLResult
from .models import Event, EventEmbedding, EventSource, SourcePost, utc_now
from .nlp_processor import NLPResult, XLMRNLPProcessor
from .schemas import NormalizedEvent, parse_kafka_payload


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ProcessingResult:
    status: str
    event_id: str | None = None
    source_post_id: str | None = None
    occurrence_count: int | None = None
    duplicate: bool = False


class EventProcessor:
    def __init__(
        self,
        *,
        settings: ListenerSettings,
        session_factory: sessionmaker[Session],
        nlp_processor: XLMRNLPProcessor,
        ml_processor: EventMLProcessor,
        matcher: EventMatcher,
    ):
        self.settings = settings
        self.session_factory = session_factory
        self.nlp_processor = nlp_processor
        self.ml_processor = ml_processor
        self.matcher = matcher

    def process_payload(self, payload: dict[str, Any]) -> ProcessingResult:
        normalized = parse_kafka_payload(payload)
        logger.info("event=message_validated source=%s", normalized.source)

        with session_scope(self.session_factory) as session:
            duplicate = self._find_duplicate(session, normalized)
            if duplicate:
                logger.info(
                    "event=duplicate_detected dedupe_key=%s source_post_id=%s",
                    normalized.dedupe_key,
                    duplicate.id,
                )
                return ProcessingResult(
                    status="duplicate",
                    event_id=str(duplicate.event_id) if duplicate.event_id else None,
                    source_post_id=str(duplicate.id),
                    occurrence_count=None,
                    duplicate=True,
                )

            nlp = self.nlp_processor.process(normalized.text, normalized.location)
            logger.info(
                "event=nlp_processed language=%s keywords=%s",
                nlp.language,
                ",".join(nlp.keywords[:5]),
            )

            ml = self.ml_processor.classify(normalized, nlp)
            logger.info(
                "event=event_classified is_event=%s event_type=%s classifier=%s",
                ml.is_event,
                ml.event_type,
                ml.classifier_name,
            )

            if not ml.is_event:
                source_post = self._create_source_post(
                    session=session,
                    normalized=normalized,
                    nlp=nlp,
                    ml=ml,
                    event=None,
                )
                return ProcessingResult(
                    status="ignored_non_event",
                    source_post_id=str(source_post.id),
                    duplicate=False,
                )

            match = self.matcher.find_matching_event(
                session=session,
                normalized_event=normalized,
                nlp=nlp,
                event_type=ml.event_type,
            )

            if match:
                event = self._update_existing_event(
                    session=session,
                    event=match.event,
                    normalized=normalized,
                    nlp=nlp,
                    ml=ml,
                )
                source_post = self._create_source_post(
                    session=session,
                    normalized=normalized,
                    nlp=nlp,
                    ml=ml,
                    event=event,
                )
                relation = EventSource(event_id=event.id, source_id=source_post.id)
                session.merge(relation)
                logger.info(
                    "event=occurrence_count_updated event_id=%s count=%s",
                    event.id,
                    event.source_count,
                )
                return ProcessingResult(
                    status="updated",
                    event_id=str(event.id),
                    source_post_id=str(source_post.id),
                    occurrence_count=event.source_count,
                )

            event = self._create_new_event(
                session=session,
                normalized=normalized,
                nlp=nlp,
                ml=ml,
            )
            source_post = self._create_source_post(
                session=session,
                normalized=normalized,
                nlp=nlp,
                ml=ml,
                event=event,
            )
            relation = EventSource(event_id=event.id, source_id=source_post.id)
            session.add(relation)
            logger.info("event=new_event_created event_id=%s", event.id)

            return ProcessingResult(
                status="created",
                event_id=str(event.id),
                source_post_id=str(source_post.id),
                occurrence_count=event.source_count,
            )

    def _find_duplicate(
        self,
        session: Session,
        normalized: NormalizedEvent,
    ) -> Optional[SourcePost]:
        checks = []
        if normalized.external_id:
            checks.append(
                (SourcePost.platform == normalized.source)
                & (SourcePost.external_id == normalized.external_id)
            )
        if normalized.url:
            checks.append(SourcePost.source_url == normalized.url)

        checks.append(SourcePost.raw_data["dedupe_key"].as_string() == normalized.dedupe_key)

        return session.scalar(select(SourcePost).where(or_(*checks)).limit(1))

    def _create_new_event(
        self,
        *,
        session: Session,
        normalized: NormalizedEvent,
        nlp: NLPResult,
        ml: MLResult,
    ) -> Event:
        status = "assumed" if self.settings.assumed_event_threshold <= 1 else "unverified"
        verification_status = "ASSUMED" if status == "assumed" else "PENDING"

        event = Event(
            event_type=ml.event_type,
            title=_make_title(normalized.text),
            description=normalized.text,
            latitude=normalized.latitude,
            longitude=normalized.longitude,
            location_name=nlp.location or normalized.location,
            event_time=normalized.timestamp,
            detected_at=utc_now(),
            status=status,
            verification_status=verification_status,
            credibility_score=_decimal_or_none(ml.credibility_score),
            ml_score=_decimal_or_none(ml.confidence_score),
            source_count=1,
            threshold_count=self.settings.assumed_event_threshold,
        )
        session.add(event)
        session.flush()

        session.add(
            EventEmbedding(
                event_id=event.id,
                embedding=nlp.embedding,
                model_name=nlp.model_name,
            )
        )

        if event.status == "assumed":
            logger.info("event=event_became_assumed event_id=%s count=%s", event.id, event.source_count)

        return event

    def _update_existing_event(
        self,
        *,
        session: Session,
        event: Event,
        normalized: NormalizedEvent,
        nlp: NLPResult,
        ml: MLResult,
    ) -> Event:
        old_count = max(event.source_count or 0, 0)
        new_count = old_count + 1

        event.source_count = new_count
        event.threshold_count = self.settings.assumed_event_threshold
        event.updated_at = utc_now()
        event.detected_at = event.detected_at or utc_now()
        event.event_time = event.event_time or normalized.timestamp
        event.location_name = event.location_name or nlp.location or normalized.location
        event.latitude = event.latitude if event.latitude is not None else normalized.latitude
        event.longitude = event.longitude if event.longitude is not None else normalized.longitude
        if not event.description:
            event.description = normalized.text
        if not event.title:
            event.title = _make_title(normalized.text)

        if ml.credibility_score is not None:
            event.credibility_score = _max_decimal(event.credibility_score, ml.credibility_score)

        if (
            new_count >= self.settings.assumed_event_threshold
            and event.status in {"unverified", "pending"}
        ):
            event.status = "assumed"
            event.verification_status = "ASSUMED"
            logger.info("event=event_became_assumed event_id=%s count=%s", event.id, new_count)
        elif not event.verification_status:
            event.verification_status = "PENDING"

        existing_embedding = session.get(EventEmbedding, event.id)
        if existing_embedding:
            existing_embedding.embedding = _running_average(
                list(existing_embedding.embedding),
                nlp.embedding,
                old_count,
            )
            existing_embedding.model_name = nlp.model_name
            existing_embedding.updated_at = utc_now()
        else:
            session.add(
                EventEmbedding(
                    event_id=event.id,
                    embedding=nlp.embedding,
                    model_name=nlp.model_name,
                )
            )

        session.flush()
        return event

    def _create_source_post(
        self,
        *,
        session: Session,
        normalized: NormalizedEvent,
        nlp: NLPResult,
        ml: MLResult,
        event: Event | None,
    ) -> SourcePost:
        raw_data = {
            "payload": normalized.raw_payload,
            "content_hash": normalized.content_hash,
            "dedupe_key": normalized.dedupe_key,
            "upstream_event_type": normalized.upstream_event_type,
            "nlp": {
                "language": nlp.language,
                "entities": nlp.entities,
                "keywords": nlp.keywords,
                "location": nlp.location,
                "model_name": nlp.model_name,
            },
            "ml": {
                "is_event": ml.is_event,
                "event_type": ml.event_type,
                "classifier_name": ml.classifier_name,
                "relevance_signals": ml.relevance_signals,
            },
        }

        source_post = SourcePost(
            event_id=event.id if event else None,
            platform=normalized.source[:50],
            source_url=normalized.url,
            external_id=normalized.external_id,
            author_name=normalized.author,
            content=normalized.text,
            media_url=normalized.media_url,
            published_at=normalized.timestamp,
            credibility_score=_decimal_or_none(ml.credibility_score),
            is_high_trust=bool(ml.relevance_signals.get("high_trust_source")),
            raw_data=raw_data,
        )
        session.add(source_post)
        session.flush()
        return source_post


def _make_title(text: str, limit: int = 14) -> str:
    words = text.split()
    title = " ".join(words[:limit]).strip()
    if len(words) > limit:
        title += "..."
    return title[:240]


def _decimal_or_none(value: float | None) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(round(value, 4)))


def _max_decimal(existing: Any, candidate: float) -> Decimal:
    candidate_decimal = _decimal_or_none(candidate)
    if candidate_decimal is None:
        return existing
    if existing is None:
        return candidate_decimal
    return max(Decimal(str(existing)), candidate_decimal)


def _running_average(
    current: list[float],
    incoming: list[float],
    current_count: int,
) -> list[float]:
    if not current or len(current) != len(incoming):
        return incoming
    count = max(current_count, 1)
    return [
        ((current_value * count) + incoming_value) / (count + 1)
        for current_value, incoming_value in zip(current, incoming)
    ]

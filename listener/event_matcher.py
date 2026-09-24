from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .config import ListenerSettings
from .models import Event, EventEmbedding, utc_now
from .nlp_processor import NLPResult, cosine_similarity
from .schemas import NormalizedEvent


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class MatchResult:
    event: Event
    semantic_similarity: float
    adjusted_score: float
    reason: str


class EventMatcher:
    def __init__(self, settings: ListenerSettings):
        self.similarity_threshold = settings.similarity_threshold
        self.time_window = timedelta(hours=settings.matching_time_window_hours)
        self.candidate_limit = settings.matching_candidate_limit

    def find_matching_event(
        self,
        session: Session,
        normalized_event: NormalizedEvent,
        nlp: NLPResult,
        event_type: str,
    ) -> Optional[MatchResult]:
        candidates = self._candidate_query(
            session=session,
            normalized_event=normalized_event,
            event_type=event_type,
        )

        best: Optional[MatchResult] = None

        for event, embedding in candidates:
            if not embedding or not embedding.embedding:
                continue

            semantic = cosine_similarity(nlp.embedding, list(embedding.embedding))
            adjusted = semantic
            reasons = [f"semantic={semantic:.4f}"]

            if _same_location(normalized_event.location or nlp.location, event.location_name):
                adjusted += 0.05
                reasons.append("location_match")

            keyword_overlap = _keyword_overlap(nlp.keywords, event.description or event.title or "")
            if keyword_overlap:
                adjusted += min(0.05, keyword_overlap * 0.01)
                reasons.append(f"keyword_overlap={keyword_overlap}")

            adjusted = min(adjusted, 1.0)

            if semantic >= self.similarity_threshold or (
                adjusted >= self.similarity_threshold
                and semantic >= self.similarity_threshold - 0.08
            ):
                match = MatchResult(
                    event=event,
                    semantic_similarity=semantic,
                    adjusted_score=adjusted,
                    reason=", ".join(reasons),
                )
                if best is None or match.adjusted_score > best.adjusted_score:
                    best = match

        if best:
            logger.info(
                "event=existing_event_matched event_id=%s score=%.4f reason=%s",
                best.event.id,
                best.adjusted_score,
                best.reason,
            )

        return best

    def _candidate_query(
        self,
        *,
        session: Session,
        normalized_event: NormalizedEvent,
        event_type: str,
    ) -> list[tuple[Event, EventEmbedding]]:
        now = utc_now()
        event_time = normalized_event.timestamp or now
        lower = event_time - self.time_window
        upper = event_time + self.time_window

        location = normalized_event.location

        query = (
            select(Event, EventEmbedding)
            .join(EventEmbedding, EventEmbedding.event_id == Event.id)
            .where(
                Event.event_time.is_(None)
                | Event.event_time.between(lower, upper)
                | Event.detected_at.between(lower, upper)
            )
            .where(Event.event_type == event_type)
            .order_by(Event.updated_at.desc())
            .limit(self.candidate_limit)
        )

        if location:
            query = query.where(
                or_(
                    Event.location_name.is_(None),
                    Event.location_name.ilike(f"%{location}%"),
                    Event.location_name.ilike("%India%"),
                )
            )

        return list(session.execute(query).all())


def _same_location(left: str | None, right: str | None) -> bool:
    if not left or not right:
        return False
    left_normalized = " ".join(left.lower().split())
    right_normalized = " ".join(right.lower().split())
    return left_normalized in right_normalized or right_normalized in left_normalized


def _keyword_overlap(keywords: list[str], existing_text: str) -> int:
    lowered = existing_text.lower()
    return sum(1 for keyword in keywords if keyword.lower() in lowered)

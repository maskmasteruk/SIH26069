from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .nlp_processor import NLPResult
from .schemas import NormalizedEvent


@dataclass(frozen=True)
class MLResult:
    is_event: bool
    event_type: str
    confidence_score: float | None
    credibility_score: float | None
    relevance_signals: dict[str, Any]
    classifier_name: str


class EventMLProcessor:
    """Classifier interface for event detection and category assignment.

    This project does not currently include a trained event classifier. The
    default implementation is a deterministic rules-based adapter that keeps
    numeric ML confidence fields empty instead of inventing scores. Replace
    this class or subclass it when a trained model artifact is available.
    """

    CATEGORY_KEYWORDS = {
        "flood": {"flood", "flooding", "waterlogging", "inundation", "overflow"},
        "heavy_rain": {"rain", "rainfall", "downpour", "cloudburst", "monsoon"},
        "cyclone": {"cyclone", "storm", "depression", "landfall"},
        "landslide": {"landslide", "mudslide", "slope", "rockfall"},
        "heatwave": {"heatwave", "heat", "temperature", "hot"},
        "weather_alert": {"alert", "warning", "forecast", "red", "orange"},
    }

    EVENT_TERMS = {
        "flood",
        "rain",
        "rainfall",
        "cyclone",
        "storm",
        "landslide",
        "heatwave",
        "warning",
        "alert",
        "damage",
        "rescue",
        "evacuation",
        "waterlogging",
    }

    HIGH_TRUST_SOURCE_TERMS = {"news", "weather", "ndtv", "the hindu", "times", "government"}

    def classify(self, event: NormalizedEvent, nlp: NLPResult) -> MLResult:
        text_terms = set(nlp.keywords)
        lowered_text = event.text.lower()

        category = "general_event"
        best_overlap = 0
        for candidate, keywords in self.CATEGORY_KEYWORDS.items():
            overlap = len(keywords & text_terms) + sum(
                1 for keyword in keywords if keyword in lowered_text
            )
            if overlap > best_overlap:
                best_overlap = overlap
                category = candidate

        has_event_signal = (
            best_overlap > 0
            or any(term in lowered_text for term in self.EVENT_TERMS)
            or bool(event.upstream_event_type)
        )

        source_lower = event.source.lower()
        is_high_trust = any(term in source_lower for term in self.HIGH_TRUST_SOURCE_TERMS)

        return MLResult(
            is_event=has_event_signal,
            event_type=category,
            confidence_score=None,
            credibility_score=None,
            relevance_signals={
                "category_keyword_overlap": best_overlap,
                "has_upstream_event_type": bool(event.upstream_event_type),
                "high_trust_source": is_high_trust,
                "classifier_note": "No trained ML classifier configured; rules only.",
            },
            classifier_name="rules_stub",
        )

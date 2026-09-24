from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from shared.event_validation import is_future_datetime, is_inside_india


class IncomingKafkaEvent(BaseModel):
    model_config = ConfigDict(extra="allow")

    text: Optional[str] = None
    source: Optional[Any] = None
    timestamp: Optional[Any] = None
    location: Optional[Any] = None
    url: Optional[str] = None
    event_id: Optional[str] = None
    event_type: Optional[str] = None

    @field_validator("text", mode="before")
    @classmethod
    def coerce_text(cls, value: Any) -> Any:
        if value is None:
            return None
        return str(value)


class NormalizedEvent(BaseModel):
    raw_payload: dict[str, Any]
    text: str
    source: str
    timestamp: Optional[datetime] = None
    location: Optional[str] = None
    url: Optional[str] = None
    external_id: Optional[str] = None
    upstream_event_type: Optional[str] = None
    author: Optional[str] = None
    media_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    content_hash: str
    dedupe_key: str


def parse_kafka_payload(payload: Any) -> NormalizedEvent:
    if not isinstance(payload, dict):
        raise ValueError("Kafka payload must be a JSON object")

    try:
        parsed = IncomingKafkaEvent.model_validate(payload)
    except ValidationError as exc:
        raise ValueError(f"Invalid Kafka event: {exc}") from exc

    data = parsed.model_dump(mode="python")
    data.update(parsed.model_extra or {})

    text = _extract_text(data)
    if not text:
        raise ValueError("Kafka event does not contain usable text")

    source = _extract_source(data)
    timestamp = _parse_timestamp(
        data.get("timestamp")
        or data.get("event_timestamp")
        or data.get("emitted_at")
        or _nested(data, "article", "published_at")
        or _nested(data, "post", "published_at")
        or data.get("published_at")
    )
    location = _extract_location(data)
    url = data.get("url") or _nested(data, "article", "url") or _nested(data, "post", "url")
    external_id = _extract_external_id(data)
    latitude = _coerce_float(
        data.get("latitude")
        or _nested(data, "location", "latitude")
        or _nested(data, "location", "lat")
        or _nested(data, "post", "latitude")
        or _nested(data, "post", "location", "latitude")
        or _nested(data, "post", "location", "lat")
    )
    longitude = _coerce_float(
        data.get("longitude")
        or data.get("lng")
        or _nested(data, "location", "longitude")
        or _nested(data, "location", "lng")
        or _nested(data, "post", "longitude")
        or _nested(data, "post", "lng")
        or _nested(data, "post", "location", "longitude")
        or _nested(data, "post", "location", "lng")
    )

    if timestamp and is_future_datetime(timestamp):
        raise ValueError("Kafka event timestamp is in the future")
    if not is_inside_india(latitude, longitude):
        raise ValueError("Kafka event must include latitude/longitude inside India")

    content_hash = _hash_text(text)
    dedupe_key = _build_dedupe_key(
        external_id=external_id,
        url=url,
        source=source,
        timestamp=timestamp,
        content_hash=content_hash,
    )

    return NormalizedEvent(
        raw_payload=payload,
        text=text,
        source=source,
        timestamp=timestamp,
        location=location,
        url=url,
        external_id=external_id,
        upstream_event_type=data.get("event_type"),
        author=_nested(data, "article", "author")
        or _nested(data, "post", "author")
        or data.get("author"),
        media_url=_nested(data, "post", "media_url") or data.get("media_url"),
        latitude=latitude,
        longitude=longitude,
        content_hash=content_hash,
        dedupe_key=dedupe_key,
    )


def deserialize_kafka_value(value: bytes | str | dict[str, Any]) -> dict[str, Any]:
    if isinstance(value, dict):
        return value

    if isinstance(value, bytes):
        value = value.decode("utf-8")

    if not isinstance(value, str):
        raise ValueError("Kafka value must be bytes, text, or a JSON object")

    try:
        payload = json.loads(value)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON Kafka message: {exc}") from exc

    if not isinstance(payload, dict):
        raise ValueError("Kafka JSON message must decode to an object")
    return payload


def _extract_text(data: dict[str, Any]) -> str:
    candidates = [
        data.get("text"),
        data.get("description"),
        data.get("summary"),
        data.get("title"),
        _nested(data, "content", "text"),
        _nested(data, "content", "excerpt"),
        _nested(data, "article", "title"),
        _nested(data, "article", "description"),
        _nested(data, "post", "title"),
        _nested(data, "post", "text"),
    ]
    parts = [str(item).strip() for item in candidates if item]
    return " ".join(dict.fromkeys(parts)).strip()


def _extract_source(data: dict[str, Any]) -> str:
    source = data.get("source")
    if isinstance(source, dict):
        return (
            source.get("name")
            or source.get("platform")
            or source.get("type")
            or source.get("region")
            or "unknown"
        )
    if source:
        return str(source)
    return str(data.get("platform") or _nested(data, "post", "platform") or "unknown")


def _extract_location(data: dict[str, Any]) -> Optional[str]:
    location = data.get("location") or _nested(data, "post", "location")
    if isinstance(location, dict):
        for key in ("name", "city", "state", "district", "region"):
            if location.get(key):
                return str(location[key])
    if location:
        return str(location)

    weather_locations = _nested(data, "weather", "locations")
    if isinstance(weather_locations, list) and weather_locations:
        return str(weather_locations[0])

    source_region = _nested(data, "source", "region")
    if source_region:
        return str(source_region)
    return None


def _extract_external_id(data: dict[str, Any]) -> Optional[str]:
    for value in (
        data.get("event_id"),
        data.get("message_id"),
        data.get("id"),
        data.get("post_id"),
        _nested(data, "post", "post_id"),
        _nested(data, "post", "id"),
        _nested(data, "article", "id"),
    ):
        if value:
            return str(value)
    return None


def _nested(data: dict[str, Any], *keys: str) -> Any:
    current: Any = data
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def _parse_timestamp(value: Any) -> Optional[datetime]:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    text_value = str(value).strip()
    if not text_value:
        return None

    if text_value.endswith("Z"):
        text_value = text_value[:-1] + "+00:00"

    try:
        parsed = datetime.fromisoformat(text_value)
    except ValueError:
        return None

    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _hash_text(text: str) -> str:
    normalized = " ".join(text.lower().split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _build_dedupe_key(
    *,
    external_id: Optional[str],
    url: Optional[str],
    source: str,
    timestamp: Optional[datetime],
    content_hash: str,
) -> str:
    if external_id:
        return f"id:{source}:{external_id}"
    if url:
        return f"url:{url.strip().lower()}"

    timestamp_key = timestamp.isoformat() if timestamp else ""
    if source and timestamp_key:
        return f"source-time-content:{source}:{timestamp_key}:{content_hash}"
    return f"content:{content_hash}"


def _coerce_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None

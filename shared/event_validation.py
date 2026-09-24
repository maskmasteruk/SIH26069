from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Iterable


INDIA_LAT_MIN = 6.0
INDIA_LAT_MAX = 37.6
INDIA_LON_MIN = 68.0
INDIA_LON_MAX = 97.5

FUTURE_TOLERANCE = timedelta(minutes=5)

INDIA_LOCATIONS: dict[str, tuple[str, float, float]] = {
    "india": ("India", 22.9734, 78.6569),
    "andaman and nicobar islands": ("Andaman and Nicobar Islands", 11.7401, 92.6586),
    "andhra pradesh": ("Andhra Pradesh", 15.9129, 79.7400),
    "arunachal pradesh": ("Arunachal Pradesh", 28.2180, 94.7278),
    "assam": ("Assam", 26.2006, 92.9376),
    "bihar": ("Bihar", 25.0961, 85.3131),
    "chandigarh": ("Chandigarh", 30.7333, 76.7794),
    "chhattisgarh": ("Chhattisgarh", 21.2787, 81.8661),
    "delhi": ("Delhi", 28.7041, 77.1025),
    "new delhi": ("Delhi", 28.6139, 77.2090),
    "goa": ("Goa", 15.2993, 74.1240),
    "gujarat": ("Gujarat", 22.2587, 71.1924),
    "haryana": ("Haryana", 29.0588, 76.0856),
    "himachal pradesh": ("Himachal Pradesh", 31.1048, 77.1734),
    "jammu and kashmir": ("Jammu and Kashmir", 33.7782, 76.5762),
    "jharkhand": ("Jharkhand", 23.6102, 85.2799),
    "karnataka": ("Karnataka", 15.3173, 75.7139),
    "kerala": ("Kerala", 10.8505, 76.2711),
    "ladakh": ("Ladakh", 34.1526, 77.5770),
    "lakshadweep": ("Lakshadweep", 10.5667, 72.6417),
    "madhya pradesh": ("Madhya Pradesh", 22.9734, 78.6569),
    "maharashtra": ("Maharashtra", 19.7515, 75.7139),
    "manipur": ("Manipur", 24.6637, 93.9063),
    "meghalaya": ("Meghalaya", 25.4670, 91.3662),
    "mizoram": ("Mizoram", 23.1645, 92.9376),
    "nagaland": ("Nagaland", 26.1584, 94.5624),
    "odisha": ("Odisha", 20.9517, 85.0985),
    "orissa": ("Odisha", 20.9517, 85.0985),
    "puducherry": ("Puducherry", 11.9416, 79.8083),
    "punjab": ("Punjab", 31.1471, 75.3412),
    "rajasthan": ("Rajasthan", 27.0238, 74.2179),
    "sikkim": ("Sikkim", 27.5330, 88.5122),
    "tamil nadu": ("Tamil Nadu", 11.1271, 78.6569),
    "telangana": ("Telangana", 18.1124, 79.0193),
    "tripura": ("Tripura", 23.9408, 91.9882),
    "uttar pradesh": ("Uttar Pradesh", 26.8467, 80.9462),
    "uttarakhand": ("Uttarakhand", 30.0668, 79.0193),
    "west bengal": ("West Bengal", 22.9868, 87.8550),
    "ahmedabad": ("Gujarat", 23.0225, 72.5714),
    "bengaluru": ("Karnataka", 12.9716, 77.5946),
    "bangalore": ("Karnataka", 12.9716, 77.5946),
    "bhopal": ("Madhya Pradesh", 23.2599, 77.4126),
    "bhubaneswar": ("Odisha", 20.2961, 85.8245),
    "chandrapur": ("Maharashtra", 19.9615, 79.2961),
    "chennai": ("Tamil Nadu", 13.0827, 80.2707),
    "coimbatore": ("Tamil Nadu", 11.0168, 76.9558),
    "dehradun": ("Uttarakhand", 30.3165, 78.0322),
    "dhubri": ("Assam", 26.0207, 89.9743),
    "guwahati": ("Assam", 26.1445, 91.7362),
    "hyderabad": ("Telangana", 17.3850, 78.4867),
    "jaipur": ("Rajasthan", 26.9124, 75.7873),
    "jorhat": ("Assam", 26.7509, 94.2037),
    "kochi": ("Kerala", 9.9312, 76.2673),
    "kolkata": ("West Bengal", 22.5726, 88.3639),
    "lucknow": ("Uttar Pradesh", 26.8467, 80.9462),
    "madurai": ("Tamil Nadu", 9.9252, 78.1198),
    "majuli": ("Assam", 26.9500, 94.2167),
    "mumbai": ("Maharashtra", 19.0760, 72.8777),
    "mysuru": ("Karnataka", 12.2958, 76.6394),
    "nagpur": ("Maharashtra", 21.1458, 79.0882),
    "noida": ("Uttar Pradesh", 28.5355, 77.3910),
    "patna": ("Bihar", 25.5941, 85.1376),
    "pune": ("Maharashtra", 18.5204, 73.8567),
    "puri": ("Odisha", 19.8135, 85.8312),
    "ranchi": ("Jharkhand", 23.3441, 85.3096),
    "surat": ("Gujarat", 21.1702, 72.8311),
    "thiruvananthapuram": ("Kerala", 8.5241, 76.9366),
    "tiruppur": ("Tamil Nadu", 11.1085, 77.3411),
    "trichy": ("Tamil Nadu", 10.7905, 78.7047),
    "tiruchirappalli": ("Tamil Nadu", 10.7905, 78.7047),
    "velachery": ("Tamil Nadu", 12.9815, 80.2180),
    "visakhapatnam": ("Andhra Pradesh", 17.6868, 83.2185),
    "vijayawada": ("Andhra Pradesh", 16.5062, 80.6480),
    "wayanad": ("Kerala", 11.6854, 76.1320),
    "meppadi": ("Kerala", 11.5518, 76.1264),
}

FUTURE_REFERENCE_PATTERNS = [
    r"\bforecast(?:ed|s|ing)?\b",
    r"\bexpected\s+to\b",
    r"\blikely\s+to\b",
    r"\bmay\s+(?:hit|bring|cause|trigger|make|occur)\b",
    r"\bcould\s+(?:hit|bring|cause|trigger|make|occur)\b",
    r"\bwill\s+(?:hit|bring|cause|trigger|make|occur|make\s+landfall)\b",
    r"\bto\s+make\s+landfall\b",
    r"\bset\s+to\b",
    r"\bwarning\s+for\b",
    r"\balert\s+for\b",
    r"\btomorrow\b",
    r"\bnext\s+(?:day|week|month|year|24|48|72)\b",
    r"\bupcoming\b",
    r"\bpredicted\b",
]

PAST_OCCURRENCE_PATTERNS = [
    r"\boccurred\b",
    r"\bhappened\b",
    r"\bhit\b",
    r"\bstruck\b",
    r"\blashe[ds]\b",
    r"\bbattered\b",
    r"\bcaused\b",
    r"\btriggered\b",
    r"\breported\b",
    r"\brecorded\b",
    r"\baffected\b",
    r"\bdisplaced\b",
    r"\brescued\b",
    r"\bkilled\b",
    r"\bdied\b",
    r"\bdamaged\b",
    r"\bcollapsed\b",
    r"\bbreached\b",
    r"\binundated\b",
    r"\bsubmerged\b",
    r"\bflooded\b",
    r"\bwater(?:logging)?\s+(?:entered|reported|recorded)\b",
    r"\bafter(?:math)?\b",
]


@dataclass(frozen=True)
class IndianLocation:
    name: str
    state: str
    latitude: float
    longitude: float
    confidence: int


@dataclass(frozen=True)
class KafkaEventValidation:
    is_valid: bool
    reason: str
    occurred_at: datetime | None = None
    location: IndianLocation | None = None


def parse_datetime(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), timezone.utc)
        except (OSError, OverflowError, ValueError):
            return None

    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"

    for fmt in ("%Y%m%dT%H%M%SZ", "%Y%m%d%H%M%S", "%Y-%m-%d", "%d %b %Y", "%d %B %Y"):
        try:
            parsed = datetime.strptime(str(value).strip(), fmt)
            return parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            pass

    try:
        parsed = datetime.fromisoformat(text)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        pass

    try:
        parsed = parsedate_to_datetime(str(value))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def is_inside_india(latitude: float | None, longitude: float | None) -> bool:
    if latitude is None or longitude is None:
        return False
    return INDIA_LAT_MIN <= latitude <= INDIA_LAT_MAX and INDIA_LON_MIN <= longitude <= INDIA_LON_MAX


def find_indian_location(*texts: str | None) -> IndianLocation | None:
    combined = " ".join(str(text) for text in texts if text).lower()
    if not combined:
        return None

    for name in sorted(INDIA_LOCATIONS, key=len, reverse=True):
        if re.search(r"(?<![a-z])" + re.escape(name) + r"(?![a-z])", combined, flags=re.IGNORECASE):
            state, latitude, longitude = INDIA_LOCATIONS[name]
            confidence = 70 if name == "india" else 92
            return IndianLocation(
                name=name.title(),
                state=state,
                latitude=latitude,
                longitude=longitude,
                confidence=confidence,
            )

    return None


def infer_event_datetime(*values: Any) -> datetime | None:
    for value in values:
        parsed = parse_datetime(value)
        if parsed:
            return parsed
    return None


def is_future_datetime(value: datetime | None, now: datetime | None = None) -> bool:
    if value is None:
        return False
    reference = now or datetime.now(timezone.utc)
    return value > reference + FUTURE_TOLERANCE


def has_future_reference(text: str, now: datetime | None = None) -> bool:
    lowered = text.lower()
    has_future = any(re.search(pattern, lowered, flags=re.IGNORECASE) for pattern in FUTURE_REFERENCE_PATTERNS)
    if not has_future:
        return False

    has_past = any(re.search(pattern, lowered, flags=re.IGNORECASE) for pattern in PAST_OCCURRENCE_PATTERNS)
    if has_past:
        return False

    reference = now or datetime.now(timezone.utc)
    for year in re.findall(r"\b20\d{2}\b", lowered):
        if int(year) > reference.year:
            return True

    return True


def validate_event_for_kafka(
    *,
    text: str,
    published_at: Any = None,
    location_hints: Iterable[str | None] = (),
    latitude: float | None = None,
    longitude: float | None = None,
    now: datetime | None = None,
) -> KafkaEventValidation:
    reference = now or datetime.now(timezone.utc)
    occurred_at = infer_event_datetime(published_at)

    if is_future_datetime(occurred_at, reference):
        return KafkaEventValidation(False, "event timestamp is in the future", occurred_at=occurred_at)

    if has_future_reference(text, reference):
        return KafkaEventValidation(False, "content describes a forecast/future event", occurred_at=occurred_at)

    text_parts = [text, *[hint for hint in location_hints if hint]]
    location = find_indian_location(*text_parts)

    if latitude is not None and longitude is not None:
        if not is_inside_india(latitude, longitude):
            return KafkaEventValidation(False, "coordinates are outside India", occurred_at=occurred_at)
        if location:
            location = IndianLocation(
                name=location.name,
                state=location.state,
                latitude=latitude,
                longitude=longitude,
                confidence=100,
            )
        else:
            location = IndianLocation(
                name="India",
                state="India",
                latitude=latitude,
                longitude=longitude,
                confidence=80,
            )

    if not location:
        return KafkaEventValidation(False, "no Indian location evidence found", occurred_at=occurred_at)

    if not is_inside_india(location.latitude, location.longitude):
        return KafkaEventValidation(False, "resolved coordinates are outside India", occurred_at=occurred_at)

    return KafkaEventValidation(
        True,
        "occurred event in India",
        occurred_at=occurred_at,
        location=location,
    )


def location_to_payload(location: IndianLocation) -> dict[str, Any]:
    return {
        "name": location.name,
        "state": location.state,
        "country": "India",
        "latitude": location.latitude,
        "longitude": location.longitude,
        "confidence": location.confidence,
    }

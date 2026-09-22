import os
import re
from typing import List, Optional

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

if load_dotenv:
    load_dotenv(
        os.path.join(
            BASE_DIR,
            ".env"
        )
    )


DEFAULT_WEATHER_KEYWORDS = [
    # English
    "weather",
    "rain",
    "rainfall",
    "heavy rain",
    "thunderstorm",
    "thunderstorms",
    "lightning",
    "cyclone",
    "storm",
    "monsoon",
    "heatwave",
    "heat wave",
    "temperature",
    "cold wave",
    "flood",
    "flooding",
    "imd",
    "meteorological",
    "forecast",
    "cloudburst",
    "landslide",
    "low pressure",
    "depression",
    "humidity",
    "hailstorm",

    # Tamil
    "மழை",
    "வானிலை",
    "புயல்",
    "வெள்ளம்",
    "கனமழை",
    "வெப்பநிலை",

    # Hindi
    "मौसम",
    "बारिश",
    "तूफान",
    "चक्रवात",
    "बाढ़",
    "मानसून",
    "गर्मी",

    # Malayalam
    "മഴ",
    "കാലാവസ്ഥ",
    "ചുഴലിക്കാറ്റ്",
    "വെള്ളപ്പൊക്കം",

    # Telugu
    "వర్షం",
    "వాతావరణం",
    "తుఫాను",
    "వరద",

    # Bengali
    "বৃষ্টি",
    "আবহাওয়া",
    "ঘূর্ণিঝড়",
    "বন্যা",

    # Marathi
    "पाऊस",
    "हवामान",
    "चक्रीवादळ",
    "पूर",

    # Kannada
    "ಮಳೆ",
    "ಹವಾಮಾನ",
    "ಚಂಡಮಾರುತ",
    "ಪ್ರವಾಹ",

    # Gujarati
    "વરસાદ",
    "હવામાન",
    "વાવાઝોડું",
    "પૂર",
]


def _env_list(name, default):
    value = os.getenv(name)

    if not value:
        return list(default)

    return [
        item.strip()
        for item in value.split(",")
        if item.strip()
    ]


def _env_int(name, default):
    return int(
        os.getenv(
            name,
            str(default)
        )
    )


WEATHER_KEYWORDS = _env_list(
    "WEATHER_KEYWORDS",
    DEFAULT_WEATHER_KEYWORDS
)

MIN_WEATHER_KEYWORD_MATCHES = _env_int(
    "MIN_WEATHER_KEYWORD_MATCHES",
    2
)


def combine_text(*parts: Optional[str]) -> str:
    return " ".join(
        str(part)
        for part in parts
        if part
    )


def _keyword_matches(text: str, keyword: str) -> bool:
    if re.search(r"\W", keyword, flags=re.UNICODE):
        pattern = re.escape(keyword)
    else:
        pattern = r"\b" + re.escape(keyword) + r"\b"

    return re.search(
        pattern,
        text,
        flags=re.IGNORECASE
    ) is not None


def find_weather_keywords(text: Optional[str]) -> List[str]:
    if not text:
        return []

    found = []
    seen = set()

    for keyword in WEATHER_KEYWORDS:
        keyword = keyword.strip()

        if not keyword:
            continue

        if not _keyword_matches(text, keyword):
            continue

        normalized = keyword.lower()

        if normalized in seen:
            continue

        seen.add(normalized)
        found.append(keyword)

    return found


def is_weather_related(
        text: Optional[str],
        min_matches: int = MIN_WEATHER_KEYWORD_MATCHES
) -> bool:
    return len(
        find_weather_keywords(text)
    ) >= min_matches


def is_weather_post(
        title: Optional[str],
        description: Optional[str],
        min_matches: int = MIN_WEATHER_KEYWORD_MATCHES
) -> bool:
    return is_weather_related(
        combine_text(
            title,
            description
        ),
        min_matches=min_matches
    )

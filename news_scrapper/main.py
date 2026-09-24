import hashlib
import json
import logging
import os
import re
import sqlite3
import sys
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin, urlparse

import requests
import trafilatura
from bs4 import BeautifulSoup
from confluent_kafka import Producer
from dotenv import load_dotenv
from weather_filter import find_weather_keywords, is_weather_related


# ============================================================
# LOAD CONFIGURATION
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

PROJECT_ROOT = os.path.dirname(BASE_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from shared.event_validation import (  # noqa: E402
    location_to_payload,
    validate_event_for_kafka,
)

load_dotenv(
    os.path.join(
        BASE_DIR,
        ".env"
    )
)


def env_bool(name, default=False):

    value = os.getenv(
        name,
        str(default)
    ).strip().lower()

    return value in (
        "1",
        "true",
        "yes",
        "on"
    )


def env_int(name, default):

    return int(
        os.getenv(
            name,
            str(default)
        )
    )


def env_float(name, default):

    return float(
        os.getenv(
            name,
            str(default)
        )
    )


def env_list(name, default):

    value = os.getenv(name)

    if not value:
        return list(default)

    return [
        item.strip()
        for item in value.split(",")
        if item.strip()
    ]


def env_json_list(name, default):

    value = os.getenv(name)

    if not value:
        return list(default)

    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"{name} must contain valid JSON"
        ) from exc

    if not isinstance(parsed, list):
        raise ValueError(
            f"{name} must contain a JSON list"
        )

    return parsed


def output_file_path(filename):

    if (
            os.path.isabs(filename)
            or os.path.dirname(filename)
    ):

        return filename

    return os.path.join(
        BASE_DIR,
        "output",
        filename
    )


def ensure_output_directory(path):

    directory = os.path.dirname(path)

    if directory:
        os.makedirs(
            directory,
            exist_ok=True
        )


def now_iso():

    return datetime.now(
        timezone.utc
    ).isoformat()


# ============================================================
# CONFIGURATION
# ============================================================

KAFKA_BOOTSTRAP_SERVERS = os.getenv(
    "KAFKA_BOOTSTRAP_SERVERS",
    "localhost:9092"
)

KAFKA_TOPIC = os.getenv(
    "KAFKA_TOPIC",
    "india_weather_news"
)

KAFKA_ACKS = os.getenv(
    "KAFKA_ACKS",
    "all"
)

KAFKA_COMPRESSION_TYPE = os.getenv(
    "KAFKA_COMPRESSION_TYPE",
    "snappy"
)

KAFKA_LINGER_MS = env_int(
    "KAFKA_LINGER_MS",
    100
)

KAFKA_RETRIES = env_int(
    "KAFKA_RETRIES",
    5
)

KAFKA_ENABLE_IDEMPOTENCE = env_bool(
    "KAFKA_ENABLE_IDEMPOTENCE",
    True
)

# Run scraping every 10 minutes
SCRAPE_INTERVAL_SECONDS = env_int(
    "SCRAPE_INTERVAL_SECONDS",
    600
)

REQUEST_TIMEOUT = env_int(
    "REQUEST_TIMEOUT",
    15
)

MAX_ARTICLES_PER_SOURCE = env_int(
    "MAX_ARTICLES_PER_SOURCE",
    30
)

SOURCE_DELAY_SECONDS = env_float(
    "SOURCE_DELAY_SECONDS",
    2
)

USER_AGENT = os.getenv(
    "USER_AGENT",
    (
        "Mozilla/5.0 (compatible; WeatherNewsMonitor/1.0; "
        "+https://example.com/weather-monitor)"
    )
)

DATABASE_FILE = output_file_path(
    os.getenv(
        "DATABASE_FILE",
        "news_scrapper.db"
    )
)

ENABLE_HISTORICAL_BACKFILL = env_bool(
    "ENABLE_HISTORICAL_BACKFILL",
    True
)

HISTORICAL_LOOKBACK_YEARS = env_int(
    "HISTORICAL_LOOKBACK_YEARS",
    10
)

HISTORICAL_MAX_RECORDS_PER_QUERY = env_int(
    "HISTORICAL_MAX_RECORDS_PER_QUERY",
    25
)

GDELT_DOC_API_URL = os.getenv(
    "GDELT_DOC_API_URL",
    "https://api.gdeltproject.org/api/v2/doc/doc"
)

HISTORICAL_EVENT_QUERIES = env_list(
    "HISTORICAL_EVENT_QUERIES",
    [
        "India flood killed",
        "India cyclone landfall damage",
        "India landslide killed",
        "India cloudburst deaths",
        "India heatwave deaths",
        "India heavy rain flooding",
    ]
)


# ============================================================
# NEWS SOURCES
# ============================================================

NEWS_SOURCES = [
    # --------------------------------------------------------
    # NATIONAL / ENGLISH
    # --------------------------------------------------------
    {
        "name": "Times of India",
        "url": "https://timesofindia.indiatimes.com/",
        "region": "India",
        "language": "English",
        "type": "national"
    },
    {
        "name": "Hindustan Times",
        "url": "https://www.hindustantimes.com/",
        "region": "India",
        "language": "English",
        "type": "national"
    },
    {
        "name": "Indian Express",
        "url": "https://indianexpress.com/",
        "region": "India",
        "language": "English",
        "type": "national"
    },
    {
        "name": "India Today",
        "url": "https://www.indiatoday.in/",
        "region": "India",
        "language": "English",
        "type": "national"
    },
    {
        "name": "NDTV",
        "url": "https://www.ndtv.com/",
        "region": "India",
        "language": "English",
        "type": "national"
    },
    {
        "name": "The Hindu",
        "url": "https://www.thehindu.com/",
        "region": "India",
        "language": "English",
        "type": "national"
    },

    # --------------------------------------------------------
    # HINDI
    # --------------------------------------------------------
    {
        "name": "Dainik Jagran",
        "url": "https://www.jagran.com/",
        "region": "North India",
        "language": "Hindi",
        "type": "regional"
    },
    {
        "name": "Amar Ujala",
        "url": "https://www.amarujala.com/",
        "region": "North India",
        "language": "Hindi",
        "type": "regional"
    },
    {
        "name": "Dainik Bhaskar",
        "url": "https://www.bhaskar.com/",
        "region": "North/Central India",
        "language": "Hindi",
        "type": "regional"
    },

    # --------------------------------------------------------
    # TAMIL
    # --------------------------------------------------------
    {
        "name": "Dinamalar",
        "url": "https://www.dinamalar.com/",
        "region": "Tamil Nadu",
        "language": "Tamil",
        "type": "regional"
    },
    {
        "name": "Dinamani",
        "url": "https://www.dinamani.com/",
        "region": "Tamil Nadu",
        "language": "Tamil",
        "type": "regional"
    },
    {
        "name": "Puthiya Thalaimurai",
        "url": "https://www.puthiyathalaimurai.com/",
        "region": "Tamil Nadu",
        "language": "Tamil",
        "type": "regional"
    },

    # --------------------------------------------------------
    # MALAYALAM
    # --------------------------------------------------------
    {
        "name": "Manorama Online",
        "url": "https://www.manoramaonline.com/",
        "region": "Kerala",
        "language": "Malayalam",
        "type": "regional"
    },
    {
        "name": "Mathrubhumi",
        "url": "https://www.mathrubhumi.com/",
        "region": "Kerala",
        "language": "Malayalam",
        "type": "regional"
    },

    # --------------------------------------------------------
    # TELUGU
    # --------------------------------------------------------
    {
        "name": "Eenadu",
        "url": "https://www.eenadu.net/",
        "region": "Andhra Pradesh/Telangana",
        "language": "Telugu",
        "type": "regional"
    },
    {
        "name": "Sakshi",
        "url": "https://www.sakshi.com/",
        "region": "Andhra Pradesh/Telangana",
        "language": "Telugu",
        "type": "regional"
    },

    # --------------------------------------------------------
    # KANNADA
    # --------------------------------------------------------
    {
        "name": "Vijaya Karnataka",
        "url": "https://vijaykarnataka.com/",
        "region": "Karnataka",
        "language": "Kannada",
        "type": "regional"
    },

    # --------------------------------------------------------
    # BENGALI
    # --------------------------------------------------------
    {
        "name": "Anandabazar",
        "url": "https://www.anandabazar.com/",
        "region": "West Bengal",
        "language": "Bengali",
        "type": "regional"
    },

    # --------------------------------------------------------
    # MARATHI
    # --------------------------------------------------------
    {
        "name": "Lokmat",
        "url": "https://www.lokmat.com/",
        "region": "Maharashtra",
        "language": "Marathi",
        "type": "regional"
    },

    # --------------------------------------------------------
    # GUJARATI
    # --------------------------------------------------------
    {
        "name": "Divya Bhaskar",
        "url": "https://www.divyabhaskar.co.in/",
        "region": "Gujarat",
        "language": "Gujarati",
        "type": "regional"
    },

    # --------------------------------------------------------
    # ODISHA
    # --------------------------------------------------------
    {
        "name": "OTV",
        "url": "https://odishatv.in/",
        "region": "Odisha",
        "language": "English/Odia",
        "type": "regional"
    },
]


NEWS_SOURCES = env_json_list(
    "NEWS_SOURCES_JSON",
    NEWS_SOURCES
)


# ============================================================
# INDIA LOCATION DETECTION
# ============================================================

INDIAN_LOCATIONS = [
    "India",

    # States
    "Tamil Nadu",
    "Kerala",
    "Karnataka",
    "Telangana",
    "Andhra Pradesh",
    "Maharashtra",
    "Gujarat",
    "Rajasthan",
    "Punjab",
    "Haryana",
    "Uttar Pradesh",
    "Uttarakhand",
    "Madhya Pradesh",
    "Odisha",
    "West Bengal",
    "Bihar",
    "Jharkhand",
    "Chhattisgarh",
    "Assam",
    "Meghalaya",
    "Goa",
    "Himachal Pradesh",

    # Major cities
    "Chennai",
    "Coimbatore",
    "Madurai",
    "Tiruppur",
    "Salem",
    "Trichy",
    "Bengaluru",
    "Bangalore",
    "Mysuru",
    "Hyderabad",
    "Vijayawada",
    "Visakhapatnam",
    "Kochi",
    "Thiruvananthapuram",
    "Kozhikode",
    "Mumbai",
    "Pune",
    "Nagpur",
    "Delhi",
    "New Delhi",
    "Gurugram",
    "Noida",
    "Kolkata",
    "Bhubaneswar",
    "Ahmedabad",
    "Surat",
    "Jaipur",
    "Lucknow",
    "Patna",
    "Ranchi",
    "Guwahati",
]


INDIAN_LOCATIONS = env_list(
    "INDIAN_LOCATIONS",
    INDIAN_LOCATIONS
)


# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

logger = logging.getLogger("weather-news-producer")


# ============================================================
# HTTP SESSION
# ============================================================

session = requests.Session()

session.headers.update({
    "User-Agent": USER_AGENT,
    "Accept-Language": "en-IN,en;q=0.9",
})


# ============================================================
# KAFKA PRODUCER
# ============================================================

producer = Producer({
    "bootstrap.servers": KAFKA_BOOTSTRAP_SERVERS,

    # Delivery reliability
    "acks": KAFKA_ACKS,

    # Compression
    "compression.type": KAFKA_COMPRESSION_TYPE,

    # batching
    "linger.ms": KAFKA_LINGER_MS,

    # allow retries
    "retries": KAFKA_RETRIES,

    # protect against duplicate delivery caused by retry
    "enable.idempotence": KAFKA_ENABLE_IDEMPOTENCE,
})


def make_article_id(url):
    """
    Generate deterministic event/article ID.
    """

    return hashlib.sha256(
        url.encode("utf-8")
    ).hexdigest()


# ============================================================
# DATABASE
# ============================================================

def connect_database():

    ensure_output_directory(
        DATABASE_FILE
    )

    connection = sqlite3.connect(
        DATABASE_FILE
    )

    connection.row_factory = sqlite3.Row

    return connection


def initialize_database():

    conn = connect_database()

    cursor = conn.cursor()

    cursor.execute("""
                   CREATE TABLE IF NOT EXISTS articles (
                       id INTEGER PRIMARY KEY AUTOINCREMENT,

                       article_id TEXT NOT NULL UNIQUE,
                       url TEXT NOT NULL,
                       title TEXT,
                       author TEXT,
                       published_at TEXT,

                       source_name TEXT,
                       source_type TEXT,
                       source_language TEXT,
                       source_region TEXT,

                       weather_keywords_json TEXT,
                       weather_locations_json TEXT,
                       excerpt TEXT,

                       first_seen TEXT,
                       last_seen TEXT,

                       raw_json TEXT
                   )
                   """)

    cursor.execute("""
                   CREATE INDEX IF NOT EXISTS
                       idx_articles_source
                       ON articles(source_name)
                   """)

    cursor.execute("""
                   CREATE INDEX IF NOT EXISTS
                       idx_articles_published
                       ON articles(published_at)
                   """)

    cursor.execute("""
                   CREATE INDEX IF NOT EXISTS
                       idx_articles_last_seen
                       ON articles(last_seen)
                   """)

    conn.commit()

    conn.close()


def save_article_event(event):

    conn = connect_database()

    cursor = conn.cursor()

    timestamp = now_iso()

    source = event.get(
        "source",
        {}
    )

    article = event.get(
        "article",
        {}
    )

    weather = event.get(
        "weather",
        {}
    )

    content = event.get(
        "content",
        {}
    )

    try:

        cursor.execute("""
                       INSERT INTO articles (
                           article_id,
                           url,
                           title,
                           author,
                           published_at,

                           source_name,
                           source_type,
                           source_language,
                           source_region,

                           weather_keywords_json,
                           weather_locations_json,
                           excerpt,

                           first_seen,
                           last_seen,

                           raw_json
                       )

                       VALUES (
                           ?, ?, ?, ?, ?,
                           ?, ?, ?, ?,
                           ?, ?, ?,
                           ?, ?,
                           ?
                       )
                       """, (
                           event.get("event_id"),
                           article.get("url"),
                           article.get("title"),
                           article.get("author"),
                           article.get("published_at"),

                           source.get("name"),
                           source.get("type"),
                           source.get("language"),
                           source.get("region"),

                           json.dumps(
                               weather.get(
                                   "keywords",
                                   []
                               ),
                               ensure_ascii=False
                           ),
                           json.dumps(
                               weather.get(
                                   "locations",
                                   []
                               ),
                               ensure_ascii=False
                           ),
                           content.get("excerpt"),

                           timestamp,
                           timestamp,

                           json.dumps(
                               event,
                               ensure_ascii=False
                           )
                       ))

        conn.commit()

        is_new = True

    except sqlite3.IntegrityError:

        cursor.execute("""
                       UPDATE articles

                       SET
                           url = ?,
                           title = ?,
                           author = ?,
                           published_at = ?,
                           source_name = ?,
                           source_type = ?,
                           source_language = ?,
                           source_region = ?,
                           weather_keywords_json = ?,
                           weather_locations_json = ?,
                           excerpt = ?,
                           last_seen = ?,
                           raw_json = ?

                       WHERE article_id = ?
                       """, (
                           article.get("url"),
                           article.get("title"),
                           article.get("author"),
                           article.get("published_at"),
                           source.get("name"),
                           source.get("type"),
                           source.get("language"),
                           source.get("region"),
                           json.dumps(
                               weather.get(
                                   "keywords",
                                   []
                               ),
                               ensure_ascii=False
                           ),
                           json.dumps(
                               weather.get(
                                   "locations",
                                   []
                               ),
                               ensure_ascii=False
                           ),
                           content.get("excerpt"),
                           timestamp,
                           json.dumps(
                               event,
                               ensure_ascii=False
                           ),
                           event.get("event_id")
                       ))

        conn.commit()

        is_new = False

    finally:

        conn.close()

    return is_new


# ============================================================
# LOCATION EXTRACTION
# ============================================================

def extract_locations(text):

    if not text:
        return []

    locations = []

    for location in INDIAN_LOCATIONS:

        if re.search(
                r"\b" + re.escape(location) + r"\b",
                text,
                flags=re.IGNORECASE
        ):
            locations.append(location)

    return list(set(locations))


# ============================================================
# URL VALIDATION
# ============================================================

def is_valid_article_url(url, base_url):

    if not url:
        return False

    parsed = urlparse(url)
    base = urlparse(base_url)

    # Only HTTP/S
    if parsed.scheme not in ("http", "https"):
        return False

    # Keep links from same website/subdomains
    if base.netloc.replace("www.", "") not in parsed.netloc.replace("www.", ""):
        return False

    # Remove obvious non-article content
    ignored = [
        "/video",
        "/videos",
        "/photo",
        "/photos",
        "/gallery",
        "/live-tv",
        "/login",
        "/signup",
        "/subscription",
        "/privacy",
        "/terms",
        "/contact",
        "/about"
    ]

    url_lower = url.lower()

    for item in ignored:
        if item in url_lower:
            return False

    return True


# ============================================================
# DISCOVER ARTICLE URLS
# ============================================================

def discover_articles(source):

    logger.info(
        "Scanning %s [%s]",
        source["name"],
        source["language"]
    )

    try:

        response = session.get(
            source["url"],
            timeout=REQUEST_TIMEOUT
        )

        response.raise_for_status()

    except Exception as e:
        logger.error(
            "Failed loading %s: %s",
            source["name"],
            e
        )

        return []

    soup = BeautifulSoup(
        response.text,
        "html.parser"
    )

    articles = []

    for anchor in soup.find_all("a", href=True):

        href = anchor.get("href")

        title = anchor.get_text(
            " ",
            strip=True
        )

        if not href:
            continue

        absolute_url = urljoin(
            source["url"],
            href
        )

        if not is_valid_article_url(
                absolute_url,
                source["url"]
        ):
            continue

        # Homepage anchor title already indicates weather article
        if is_weather_related(title):

            articles.append({
                "title_hint": title,
                "url": absolute_url
            })

    # Remove duplicate URLs
    unique = {}

    for article in articles:
        unique[article["url"]] = article

    return list(unique.values())[
        :MAX_ARTICLES_PER_SOURCE
    ]


# ============================================================
# ARTICLE EXTRACTION
# ============================================================

def extract_article(url):

    try:

        response = session.get(
            url,
            timeout=REQUEST_TIMEOUT
        )

        response.raise_for_status()

        html = response.text

        # -----------------------------------------
        # Extract main body
        # -----------------------------------------

        text = trafilatura.extract(
            html,
            include_comments=False,
            include_tables=False,
            include_links=False
        )

        # -----------------------------------------
        # Extract metadata
        # -----------------------------------------

        metadata = trafilatura.extract_metadata(html)

        title = None
        author = None
        publication_date = None

        if metadata:

            title = metadata.title
            author = metadata.author
            publication_date = metadata.date

        return {
            "title": title,
            "author": author,
            "published_at": publication_date,
            "text": text
        }

    except Exception as e:

        logger.warning(
            "Article extraction failed: %s | %s",
            url,
            e
        )

        return None


# ============================================================
# HISTORICAL ARTICLE DISCOVERY
# ============================================================

def _gdelt_datetime(value):

    return value.strftime(
        "%Y%m%d%H%M%S"
    )


def discover_historical_articles():

    if not ENABLE_HISTORICAL_BACKFILL:
        return []

    end = datetime.now(
        timezone.utc
    )

    start = end - timedelta(
        days=HISTORICAL_LOOKBACK_YEARS * 365
    )

    historical = {}

    for query in HISTORICAL_EVENT_QUERIES:

        params = {
            "query": query,
            "mode": "ArtList",
            "format": "json",
            "maxrecords": HISTORICAL_MAX_RECORDS_PER_QUERY,
            "sort": "HybridRel",
            "startdatetime": _gdelt_datetime(start),
            "enddatetime": _gdelt_datetime(end),
        }

        try:

            response = session.get(
                GDELT_DOC_API_URL,
                params=params,
                timeout=REQUEST_TIMEOUT
            )

            response.raise_for_status()

            data = response.json()

        except Exception as exc:

            logger.warning(
                "Historical query failed: %s | %s",
                query,
                exc
            )

            continue

        for item in data.get("articles", []):

            url = item.get("url")

            if not url:
                continue

            historical[url] = {
                "url": url,
                "title_hint": item.get("title") or "",
                "published_at": item.get("seendate"),
                "domain": item.get("domain"),
                "source_country": item.get("sourcecountry"),
                "query": query,
            }

        time.sleep(
            SOURCE_DELAY_SECONDS
        )

    logger.info(
        "Historical backfill discovered %d unique candidate URLs",
        len(historical)
    )

    return list(
        historical.values()
    )


def process_historical_backfill():

    source = {
        "name": "GDELT Historical Backfill",
        "type": "historical_news",
        "language": "Mixed",
        "region": "India"
    }

    candidates = discover_historical_articles()

    found_count = 0
    new_count = 0

    for item in candidates:

        url = item["url"]

        extracted = extract_article(url) or {}

        title = (
            extracted.get("title")
            or item.get("title_hint")
            or ""
        )

        published_at = (
            extracted.get("published_at")
            or item.get("published_at")
        )

        article = {
            "title": title,
            "author": extracted.get("author"),
            "published_at": published_at,
            "text": extracted.get("text") or title,
        }

        combined = f"{title} {article.get('text') or ''}"

        if not is_weather_related(combined):
            continue

        validation = validate_event_for_kafka(
            text=combined,
            published_at=published_at,
            location_hints=[
                source["region"],
                item.get("query"),
            ],
        )

        if not validation.is_valid:

            logger.info(
                "Skipping historical Kafka event: %s | %s",
                validation.reason,
                title[:100]
            )

            continue

        found_count += 1

        event = build_event(
            source,
            url,
            article,
            validation
        )

        if not save_article_event(event):
            continue

        send_to_kafka(event)

        new_count += 1

        logger.info(
            "NEW HISTORICAL WEATHER EVENT: %s",
            title[:100]
        )

    logger.info(
        "Historical backfill: found=%d new=%d",
        found_count,
        new_count
    )

    return (
        found_count,
        new_count
    )


# ============================================================
# BUILD KAFKA EVENT
# ============================================================

def build_event(source, url, article, validation):

    title = article.get("title") or ""

    text = article.get("text") or ""

    combined_text = f"{title} {text}"

    keywords = find_weather_keywords(
        combined_text
    )

    locations = extract_locations(
        combined_text
    )

    article_id = make_article_id(url)

    event = {

        # ----------------------------------------------------
        # Event metadata
        # ----------------------------------------------------

        "event_id": article_id,

        "event_type": "WEATHER_NEWS",

        "event_version": "1.0",

        "event_timestamp": now_iso(),

        "timestamp": (
            validation.occurred_at.isoformat()
            if validation.occurred_at
            else article.get("published_at")
        ),

        # ----------------------------------------------------
        # News source
        # ----------------------------------------------------

        "source": {
            "name": source["name"],
            "type": source["type"],
            "language": source["language"],
            "region": source["region"]
        },

        # ----------------------------------------------------
        # Article
        # ----------------------------------------------------

        "article": {
            "title": title,
            "url": url,
            "author": article.get("author"),
            "published_at": article.get(
                "published_at"
            )
        },

        "occurrence": {
            "status": "occurred",
            "occurred_at": (
                validation.occurred_at.isoformat()
                if validation.occurred_at
                else None
            ),
            "validation_reason": validation.reason
        },

        "location": location_to_payload(
            validation.location
        ),

        "latitude": validation.location.latitude,

        "longitude": validation.location.longitude,

        # ----------------------------------------------------
        # Weather information
        # ----------------------------------------------------

        "weather": {
            "keywords": keywords,
            "locations": locations
        },

        # ----------------------------------------------------
        # Keep Kafka messages reasonably small.
        # Instead of sending entire article, send excerpt.
        # ----------------------------------------------------

        "content": {
            "excerpt": text[:3000]
        }
    }

    return event


# ============================================================
# KAFKA DELIVERY CALLBACK
# ============================================================

def delivery_report(err, msg):

    if err is not None:

        logger.error(
            "Kafka delivery failed: %s",
            err
        )

    else:

        logger.info(
            "Kafka event → topic=%s partition=%d offset=%d",
            msg.topic(),
            msg.partition(),
            msg.offset()
        )


# ============================================================
# SEND EVENT TO KAFKA
# ============================================================

def send_to_kafka(event):

    key = event["event_id"]

    value = json.dumps(
        event,
        ensure_ascii=False
    )

    producer.produce(
        topic=KAFKA_TOPIC,
        key=key.encode("utf-8"),
        value=value.encode("utf-8"),
        callback=delivery_report
    )

    producer.poll(0)


# ============================================================
# PROCESS SOURCE
# ============================================================

def process_source(source):

    articles = discover_articles(source)

    logger.info(
        "%s: %d potential weather links",
        source["name"],
        len(articles)
    )

    found_count = 0
    new_count = 0

    for item in articles:

        url = item["url"]

        article = extract_article(url)

        if not article:
            continue

        title = article.get("title") or \
                item.get("title_hint") or ""

        article["title"] = title

        text = article.get("text") or ""

        combined = f"{title} {text}"

        # Validate after downloading article
        if not is_weather_related(combined):
            continue

        preliminary_locations = extract_locations(
            combined
        )

        validation = validate_event_for_kafka(
            text=combined,
            published_at=article.get("published_at"),
            location_hints=[
                source.get("region"),
                *preliminary_locations,
            ],
        )

        if not validation.is_valid:

            logger.info(
                "Skipping Kafka event: %s | %s | %s",
                validation.reason,
                source["name"],
                title[:100]
            )

            continue

        found_count += 1

        event = build_event(
            source,
            url,
            article,
            validation
        )

        if not save_article_event(event):

            logger.info(
                "Already found: %s | %s",
                source["name"],
                title[:100]
            )

            continue

        send_to_kafka(event)

        new_count += 1

        logger.info(
            "NEW WEATHER EVENT: %s | %s",
            source["name"],
            title[:100]
        )

    logger.info(
        "%s: found=%d new=%d",
        source["name"],
        found_count,
        new_count
    )

    return (
        found_count,
        new_count
    )


# ============================================================
# SCRAPING CYCLE
# ============================================================

def scrape_once():

    logger.info(
        "========== Weather scraping started =========="
    )

    total_found = 0
    total_new = 0

    for source in NEWS_SOURCES:

        try:

            found, new = process_source(source)

            total_found += found
            total_new += new

        except Exception as e:

            # One broken website must not stop everything
            logger.exception(
                "Source failed %s: %s",
                source["name"],
                e
            )

        # Don't hammer websites
        time.sleep(SOURCE_DELAY_SECONDS)

    if ENABLE_HISTORICAL_BACKFILL:

        try:

            found, new = process_historical_backfill()

            total_found += found
            total_new += new

        except Exception as e:

            logger.exception(
                "Historical backfill failed: %s",
                e
            )

    producer.flush()

    logger.info(
        "Cycle totals: found=%d new=%d",
        total_found,
        total_new
    )

    logger.info(
        "========== Weather scraping completed =========="
    )


# ============================================================
# MAIN
# ============================================================

def main():

    logger.info(
        "Starting Indian Weather News → Kafka Producer"
    )

    logger.info(
        "Kafka brokers: %s",
        KAFKA_BOOTSTRAP_SERVERS
    )

    logger.info(
        "Kafka topic: %s",
        KAFKA_TOPIC
    )

    logger.info(
        "Database: %s",
        DATABASE_FILE
    )

    initialize_database()

    while True:

        try:

            scrape_once()

        except KeyboardInterrupt:

            logger.info("Stopping...")
            producer.flush()
            break

        except Exception:

            logger.exception(
                "Unexpected scraping-cycle error"
            )

        logger.info(
            "Next scan in %d seconds",
            SCRAPE_INTERVAL_SECONDS
        )

        time.sleep(
            SCRAPE_INTERVAL_SECONDS
        )


if __name__ == "__main__":
    main()

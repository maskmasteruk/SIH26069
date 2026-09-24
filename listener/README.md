# Kafka Event Listener

This module consumes disaster/weather-related Kafka events, normalizes flexible JSON payloads, processes text with XLM-R, groups semantically similar reports into one logical PostgreSQL event, and stores individual source messages under that event.

It does not change the frontend/dashboard and does not create or replace any `.env` file.

## Configuration

The listener reads environment variables from existing `.env` files when present. A root `.env` is preferred, with existing service `.env` files used as fallback sources.

Required Kafka variables:

```env
KAFKA_BOOTSTRAP_SERVERS=
KAFKA_TOPIC=
KAFKA_GROUP_ID=event-listener
```

Required PostgreSQL variables:

```env
POSTGRES_HOST=
POSTGRES_PORT=
POSTGRES_DB=
POSTGRES_USER=
POSTGRES_PASSWORD=
```

Alternatively, use the existing project style:

```env
DATABASE_URL=postgresql+psycopg://user:password@host:5432/database
```

Model and matching variables:

```env
MODEL_NAME=xlm-roberta-base
SIMILARITY_THRESHOLD=0.78
ASSUMED_EVENT_THRESHOLD=5
MATCHING_TIME_WINDOW_HOURS=72
MATCHING_CANDIDATE_LIMIT=100
```

Optional Kafka security variables are also reused when present:

```env
KAFKA_SECURITY_PROTOCOL=PLAINTEXT
KAFKA_SASL_MECHANISM=PLAIN
KAFKA_USERNAME=
KAFKA_PASSWORD=
```

## Kafka Input

The parser accepts simple events:

```json
{
  "text": "Heavy rain in Chennai",
  "source": "X",
  "timestamp": "2026-09-24T01:00:00+00:00",
  "location": "Chennai",
  "url": "https://example.com/post/1"
}
```

It also accepts the existing scraper shapes, including `WEATHER_NEWS` payloads with `article`, `content`, `weather`, and nested social-media payloads with `post`.

The original Kafka payload is preserved in `source_posts.raw_data.payload`.

## Database Setup

The listener reuses the current PostgreSQL schema:

- `events`
- `source_posts`
- `event_sources`
- `event_matches`

It adds a small supplemental `event_embeddings` table for semantic vectors and creates supporting indexes for event lookup and message deduplication. If the existing `events` table lacks `verification_status`, the listener adds that nullable column during initialization.

Embeddings are stored as JSON by default. This keeps the module portable. If `pgvector` is added later, `event_embeddings` is the place to migrate vector storage and database-side similarity search.

## Processing Flow

```text
Kafka
  -> JSON deserialize
  -> validate and normalize
  -> deduplicate source message
  -> XLM-R embedding and lightweight NLP extraction
  -> event classification interface
  -> narrow PostgreSQL candidates by type, location, and time
  -> semantic similarity match
  -> update existing event or create new event
  -> write source post and relation
  -> update occurrence count
  -> mark as assumed when threshold is reached
```

## Similar Event Matching

Matching is not exact string matching. The listener uses XLM-R embeddings for semantic similarity, then considers:

- event type/category
- location
- time proximity
- keyword overlap

Candidates are narrowed before semantic scoring to avoid scanning all events.

## Deduplication

A source report is treated as duplicate when it matches an existing post by:

- message ID / event ID / post ID when present
- URL when present
- source + timestamp + content hash
- content hash fallback

Duplicates do not increment `source_count`.

## Threshold Rule

`ASSUMED_EVENT_THRESHOLD` defaults to `5`.

Before the threshold:

```text
events.status = unverified
events.verification_status = PENDING
```

At or above the threshold:

```text
events.status = assumed
events.verification_status = ASSUMED
```

The existing `events.source_count` column is used as the occurrence count.

## ML Layer

`ml_processor.py` exposes a modular classifier interface. The project currently has no trained event classifier artifact, so the default implementation uses deterministic category rules and leaves `confidence_score` as `NULL`. Connect a trained classifier by replacing or subclassing `EventMLProcessor.classify()`.

## Run

Install dependencies:

```powershell
py -m pip install -r listener/requirements.txt
```

Start the listener from Command Prompt:

```bat
cd /d D:\IdeaProjects\SIH26069_PROJECT\listener
call .venv\Scripts\activate.bat
python main.py
```

From PowerShell, use the venv interpreter directly:

```powershell
cd listener
.\.venv\Scripts\python.exe main.py
```

From the project root, module mode is also supported:

```powershell
.\listener\.venv\Scripts\python.exe -m listener.main
```

## Tests

Unit tests mock Kafka and ML/NLP behavior. They do not require a live Kafka cluster, PostgreSQL, or an XLM-R model download.

```powershell
py -m unittest discover listener/tests
```

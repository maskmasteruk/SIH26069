import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, Optional

from dotenv import load_dotenv


load_dotenv(
    os.path.join(
        os.path.dirname(
            os.path.abspath(__file__)
        ),
        ".env"
    )
)


def env_bool(name: str, default=False):
    value = os.getenv(name, str(default)).strip().lower()
    return value in ("1", "true", "yes", "on")


ENABLE_KAFKA_EVENT_STREAM = env_bool(
    "ENABLE_KAFKA_EVENT_STREAM",
    False
)

KAFKA_BOOTSTRAP_SERVERS = os.getenv(
    "KAFKA_BOOTSTRAP_SERVERS",
    "localhost:9092"
)

KAFKA_TOPIC = os.getenv(
    "KAFKA_TOPIC",
    "social_media_new_posts"
)

KAFKA_CLIENT_ID = os.getenv(
    "KAFKA_CLIENT_ID",
    "hashtag-monitor"
)

KAFKA_SECURITY_PROTOCOL = os.getenv(
    "KAFKA_SECURITY_PROTOCOL",
    "PLAINTEXT"
)

KAFKA_SASL_MECHANISM = os.getenv(
    "KAFKA_SASL_MECHANISM",
    "PLAIN"
)

KAFKA_USERNAME = os.getenv(
    "KAFKA_USERNAME",
    ""
)

KAFKA_PASSWORD = os.getenv(
    "KAFKA_PASSWORD",
    ""
)

KAFKA_SEND_TIMEOUT_SECONDS = float(
    os.getenv("KAFKA_SEND_TIMEOUT_SECONDS", "10")
)


logger = logging.getLogger(
    "kafka-event-stream"
)

producer = None
producer_unavailable = False


def build_new_post_event(post: Dict):

    return {
        "event_type": "social_media.post.created",
        "event_version": 1,
        "emitted_at": datetime.now(
            timezone.utc
        ).isoformat(),
        "platform": post.get(
            "platform"
        ),
        "hashtag": post.get(
            "hashtag"
        ),
        "post_id": str(
            post.get("post_id")
        ),
        "published_at": post.get(
            "published_at"
        ),
        "url": post.get(
            "url"
        ),
        "post": post
    }


def get_event_key(post: Dict):

    return (
        f"{post.get('platform')}:"
        f"{post.get('hashtag')}:"
        f"{post.get('post_id')}"
    )


def get_kafka_producer(
        log: Optional[logging.Logger] = None
):

    global producer
    global producer_unavailable

    if not ENABLE_KAFKA_EVENT_STREAM:

        return None

    if producer:

        return producer

    if producer_unavailable:

        return None

    active_log = log or logger

    try:

        from kafka import KafkaProducer

    except ImportError:

        producer_unavailable = True

        active_log.warning(
            "Kafka event stream is enabled but "
            "kafka-python is not installed."
        )

        return None

    bootstrap_servers = [
        server.strip()
        for server in KAFKA_BOOTSTRAP_SERVERS.split(",")
        if server.strip()
    ]

    config = {
        "bootstrap_servers": bootstrap_servers,
        "client_id": KAFKA_CLIENT_ID,
        "security_protocol": KAFKA_SECURITY_PROTOCOL,
        "request_timeout_ms": int(
            KAFKA_SEND_TIMEOUT_SECONDS
            * 1000
        ),
        "max_block_ms": int(
            KAFKA_SEND_TIMEOUT_SECONDS
            * 1000
        ),
        "value_serializer": lambda value: json.dumps(
            value,
            ensure_ascii=False
        ).encode("utf-8"),
        "key_serializer": lambda value: value.encode(
            "utf-8"
        ),
        "retries": 3
    }

    if KAFKA_USERNAME and KAFKA_PASSWORD:

        config.update({
            "sasl_mechanism": KAFKA_SASL_MECHANISM,
            "sasl_plain_username": KAFKA_USERNAME,
            "sasl_plain_password": KAFKA_PASSWORD
        })

    try:

        producer = KafkaProducer(
            **config
        )

    except Exception as exc:

        producer_unavailable = True

        active_log.warning(
            "Kafka producer could not be created: %s",
            exc
        )

        return None

    active_log.info(
        "Kafka event stream enabled. Topic: %s",
        KAFKA_TOPIC
    )

    return producer


def publish_new_post_event(
        post: Dict,
        log: Optional[logging.Logger] = None
):

    active_log = log or logger

    event_producer = get_kafka_producer(
        active_log
    )

    if not event_producer:

        return False

    event = build_new_post_event(
        post
    )

    event_key = get_event_key(
        post
    )

    try:

        result = event_producer.send(
            KAFKA_TOPIC,
            key=event_key,
            value=event
        )

        result.get(
            timeout=KAFKA_SEND_TIMEOUT_SECONDS
        )

    except Exception as exc:

        active_log.warning(
            "Kafka event publish failed for %s: %s",
            event_key,
            exc
        )

        return False

    active_log.info(
        "Kafka event published for %s",
        event_key
    )

    return True

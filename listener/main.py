from __future__ import annotations

import logging
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

    from listener.config import get_settings
    from listener.database import (
        create_database_engine,
        create_session_factory,
        initialize_database,
    )
    from listener.event_matcher import EventMatcher
    from listener.event_processor import EventProcessor
    from listener.kafka_consumer import KafkaEventConsumer
    from listener.ml_processor import EventMLProcessor
    from listener.nlp_processor import XLMRNLPProcessor
else:
    from .config import get_settings
    from .database import create_database_engine, create_session_factory, initialize_database
    from .event_matcher import EventMatcher
    from .event_processor import EventProcessor
    from .kafka_consumer import KafkaEventConsumer
    from .ml_processor import EventMLProcessor
    from .nlp_processor import XLMRNLPProcessor


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


def main() -> int:
    try:
        settings = get_settings()
        configure_logging(settings.log_level)

        engine = create_database_engine(settings)
        initialize_database(engine)
        session_factory = create_session_factory(engine)

        nlp_processor = XLMRNLPProcessor(settings)
        ml_processor = EventMLProcessor()
        matcher = EventMatcher(settings)

        processor = EventProcessor(
            settings=settings,
            session_factory=session_factory,
            nlp_processor=nlp_processor,
            ml_processor=ml_processor,
            matcher=matcher,
        )
        consumer = KafkaEventConsumer(settings, processor)
        consumer.run_forever()
        return 0
    except Exception:
        logging.exception("event=listener_startup_failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())

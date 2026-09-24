from __future__ import annotations

import logging
from typing import Any

from .config import ListenerSettings
from .event_processor import EventProcessor
from .schemas import deserialize_kafka_value


logger = logging.getLogger(__name__)


class KafkaEventConsumer:
    def __init__(self, settings: ListenerSettings, processor: EventProcessor):
        self.settings = settings
        self.processor = processor
        self.consumer = self._create_consumer()

    def _create_consumer(self):
        try:
            from confluent_kafka import Consumer
        except ImportError as exc:
            raise RuntimeError(
                "confluent-kafka is required to run the listener. "
                "Install listener/requirements.txt first."
            ) from exc

        config: dict[str, Any] = {
            "bootstrap.servers": self.settings.kafka_bootstrap_servers,
            "group.id": self.settings.kafka_group_id,
            "auto.offset.reset": self.settings.kafka_auto_offset_reset,
            "enable.auto.commit": False,
            "security.protocol": self.settings.kafka_security_protocol,
        }

        if self.settings.kafka_username and self.settings.kafka_password:
            config.update(
                {
                    "sasl.mechanism": self.settings.kafka_sasl_mechanism or "PLAIN",
                    "sasl.username": self.settings.kafka_username,
                    "sasl.password": self.settings.kafka_password,
                }
            )

        consumer = Consumer(config)
        consumer.subscribe([self.settings.kafka_topic])
        return consumer

    def run_forever(self) -> None:
        logger.info(
            "event=kafka_listener_started topic=%s group_id=%s",
            self.settings.kafka_topic,
            self.settings.kafka_group_id,
        )

        try:
            while True:
                message = self.consumer.poll(self.settings.kafka_poll_timeout_seconds)
                if message is None:
                    continue

                if message.error():
                    logger.error("event=kafka_error error=%s", message.error())
                    continue

                self._handle_message(message)
        except KeyboardInterrupt:
            logger.info("event=kafka_listener_stopped reason=keyboard_interrupt")
        finally:
            self.consumer.close()

    def _handle_message(self, message) -> None:
        logger.info(
            "event=kafka_message_received topic=%s partition=%s offset=%s",
            message.topic(),
            message.partition(),
            message.offset(),
        )

        try:
            payload = deserialize_kafka_value(message.value())
        except ValueError as exc:
            logger.warning(
                "event=message_parse_failed topic=%s offset=%s error=%s",
                message.topic(),
                message.offset(),
                exc,
            )
            self.consumer.commit(message=message, asynchronous=False)
            return

        try:
            result = self.processor.process_payload(payload)
            logger.info(
                "event=message_processed result=%s event_id=%s duplicate=%s",
                result.status,
                result.event_id,
                result.duplicate,
            )
            self.consumer.commit(message=message, asynchronous=False)
        except Exception:
            logger.exception(
                "event=message_processing_failed topic=%s offset=%s",
                message.topic(),
                message.offset(),
            )
            if self.settings.kafka_commit_on_processing_error:
                self.consumer.commit(message=message, asynchronous=False)


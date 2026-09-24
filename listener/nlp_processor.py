from __future__ import annotations

import logging
import math
import re
from dataclasses import dataclass
from typing import Iterable

from .config import ListenerSettings


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class NLPResult:
    language: str | None
    entities: list[str]
    keywords: list[str]
    location: str | None
    embedding: list[float]
    model_name: str


class XLMRNLPProcessor:
    """Reusable XLM-R embedding processor.

    XLM-R base is used for multilingual semantic representations. Entity,
    keyword, and language extraction are intentionally lightweight here so a
    trained NER/classification model can be plugged in without changing the
    listener pipeline.
    """

    LOCATION_HINTS = {
        "india",
        "chennai",
        "mumbai",
        "delhi",
        "kolkata",
        "bengaluru",
        "bangalore",
        "hyderabad",
        "kerala",
        "tamil nadu",
        "odisha",
        "maharashtra",
        "gujarat",
        "rajasthan",
        "assam",
        "uttarakhand",
    }

    STOP_WORDS = {
        "the",
        "and",
        "for",
        "with",
        "from",
        "that",
        "this",
        "after",
        "have",
        "has",
        "are",
        "was",
        "were",
        "will",
        "about",
        "into",
        "over",
        "under",
        "near",
        "heavy",
        "reported",
    }

    def __init__(self, settings: ListenerSettings):
        self.model_name = settings.model_name
        self.max_length = settings.nlp_max_length
        self._tokenizer = None
        self._model = None
        self._torch = None
        self._device = None
        self._load_model()

    def _load_model(self) -> None:
        try:
            import torch
            from transformers import AutoModel, AutoTokenizer
        except ImportError as exc:
            raise RuntimeError(
                "XLM-R NLP processing requires transformers and torch. "
                "Install listener/requirements.txt before starting the listener."
            ) from exc

        self._torch = torch
        self._device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info("event=nlp_model_loading model=%s device=%s", self.model_name, self._device)
        self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self._model = AutoModel.from_pretrained(self.model_name)
        self._model.to(self._device)
        self._model.eval()
        logger.info("event=nlp_model_loaded model=%s device=%s", self.model_name, self._device)

    def process(self, text: str, location_hint: str | None = None) -> NLPResult:
        embedding = self.embed(text)
        entities = extract_entities(text)
        keywords = extract_keywords(text, self.STOP_WORDS)
        location = location_hint or extract_location_from_text(text, self.LOCATION_HINTS)

        return NLPResult(
            language=detect_language_family(text),
            entities=entities,
            keywords=keywords,
            location=location,
            embedding=embedding,
            model_name=self.model_name,
        )

    def embed(self, text: str) -> list[float]:
        assert self._tokenizer is not None
        assert self._model is not None
        assert self._torch is not None

        encoded = self._tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=self.max_length,
            padding=True,
        )
        encoded = {key: value.to(self._device) for key, value in encoded.items()}

        with self._torch.no_grad():
            output = self._model(**encoded)
            token_embeddings = output.last_hidden_state
            attention_mask = encoded["attention_mask"].unsqueeze(-1)
            masked = token_embeddings * attention_mask
            summed = masked.sum(dim=1)
            counts = attention_mask.sum(dim=1).clamp(min=1)
            pooled = summed / counts
            normalized = self._torch.nn.functional.normalize(pooled, p=2, dim=1)

        return normalized[0].detach().cpu().tolist()


def detect_language_family(text: str) -> str | None:
    if not text:
        return None
    if re.search(r"[\u0900-\u097F]", text):
        return "indic_devanagari"
    if re.search(r"[\u0B80-\u0BFF]", text):
        return "tamil"
    if re.search(r"[\u0C00-\u0C7F]", text):
        return "telugu"
    if re.search(r"[\u0C80-\u0CFF]", text):
        return "kannada"
    if re.search(r"[\u0D00-\u0D7F]", text):
        return "malayalam"
    ascii_letters = sum(1 for ch in text if ch.isascii() and ch.isalpha())
    letters = sum(1 for ch in text if ch.isalpha())
    if letters and ascii_letters / letters > 0.8:
        return "latin"
    return "unknown"


def extract_entities(text: str) -> list[str]:
    candidates = re.findall(r"\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\b", text)
    return _unique_limited(candidates, limit=20)


def extract_keywords(text: str, stop_words: Iterable[str], limit: int = 12) -> list[str]:
    stop = set(stop_words)
    tokens = re.findall(r"[\w#@-]{4,}", text.lower(), flags=re.UNICODE)
    counts: dict[str, int] = {}
    for token in tokens:
        clean = token.strip("#@-_")
        if len(clean) < 4 or clean in stop:
            continue
        counts[clean] = counts.get(clean, 0) + 1

    return [
        word
        for word, _ in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:limit]
    ]


def extract_location_from_text(text: str, location_hints: set[str]) -> str | None:
    lowered = text.lower()
    for location in sorted(location_hints, key=len, reverse=True):
        if re.search(r"\b" + re.escape(location) + r"\b", lowered):
            return location.title()
    return None


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


def _unique_limited(values: Iterable[str], limit: int) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = " ".join(value.split()).strip()
        key = normalized.lower()
        if normalized and key not in seen:
            seen.add(key)
            result.append(normalized)
        if len(result) >= limit:
            break
    return result


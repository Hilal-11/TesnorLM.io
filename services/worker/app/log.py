"""Structured JSON logs.

Log ids, stages, durations, counts and error codes. Never document text, file contents,
filenames, prompts or keys: values under those key names are redacted as a safety net.
"""

from __future__ import annotations

import json
import logging
import sys
import time
from typing import Any

REDACT = {
    "content",
    "markdown",
    "prompt",
    "text",
    "chunk",
    "caption",
    "description",
    "filename",
    "title",
    "api_key",
    "apikey",
    "authorization",
    "token",
    "secret",
    "password",
    "key",
}


def redact(value: Any, depth: int = 0) -> Any:
    if depth > 5:
        return "[deep]"
    if isinstance(value, dict):
        return {
            k: "[redacted]" if str(k).lower() in REDACT else redact(v, depth + 1)
            for k, v in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [redact(v, depth + 1) for v in value]
    return value


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        line: dict[str, Any] = {
            "level": record.levelname.lower(),
            "msg": record.getMessage(),
            "time": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created))
            + f".{int(record.msecs):03d}Z",
            "logger": record.name,
        }
        fields = getattr(record, "fields", None)
        if isinstance(fields, dict):
            line.update(redact(fields))
        if record.exc_info and record.exc_info[0] is not None:
            # The exception type only: messages can quote document text.
            line["exception"] = record.exc_info[0].__name__
        return json.dumps(line, default=str)


def setup_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)
    # Chatty libraries: warnings only.
    for name in ("httpx", "httpcore", "docling", "rapidocr", "RapidOCR", "urllib3", "PIL"):
        logging.getLogger(name).setLevel(logging.WARNING)


class Log:
    """logger.info("stage", document_id=..., run_id=...) → one JSON line with those fields."""

    def __init__(self, name: str) -> None:
        self._log = logging.getLogger(name)

    def _emit(self, level: int, msg: str, exc: bool = False, **fields: Any) -> None:
        self._log.log(level, msg, extra={"fields": fields}, exc_info=exc)

    def info(self, msg: str, **fields: Any) -> None:
        self._emit(logging.INFO, msg, **fields)

    def warning(self, msg: str, **fields: Any) -> None:
        self._emit(logging.WARNING, msg, **fields)

    def error(self, msg: str, exc: bool = False, **fields: Any) -> None:
        self._emit(logging.ERROR, msg, exc=exc, **fields)


def get_log(name: str) -> Log:
    return Log(name)

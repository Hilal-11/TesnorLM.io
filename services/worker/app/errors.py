"""Errors the pipeline turns into a failed document with a contract error code."""

from __future__ import annotations

from typing import Any

from app.contract import CONTRACT, ERROR


class IngestError(Exception):
    """A final failure with a contract code (never retried) and its message values.

    The exception's own text is never stored or shown: people see the contract copy.
    """

    def __init__(self, code: str, values: dict[str, Any] | None = None) -> None:
        if code not in CONTRACT.errors:
            code = ERROR.internal
        super().__init__(code)
        self.code = code
        self.values = values or {}


class NeedsPassword(Exception):
    """The PDF opens only with its user password: the document waits in `needs_password`.

    Not a failure. The person types the password (P3.7v2) and the run validates again."""


class StaleRun(Exception):
    """The document was deleted or re-processed: this run must stop without writing anything."""

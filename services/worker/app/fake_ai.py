"""Deterministic stand-in for the embedding API, for local end-to-end tests (WORKER_FAKE_AI=1,
only with INNGEST_DEV=1). Vectors come from a hash of the text, so search still ranks
identical text first."""

from __future__ import annotations

import hashlib
from collections.abc import Callable


class FakeEmbedder:
    model = "fake-embedding"
    dims = 1536

    def __init__(self) -> None:
        self.tokens = 0

    def embed(self, texts: list[str], on_batch: Callable[[int], None] | None = None) -> list[list[float]]:
        out = []
        for text in texts:
            seed = hashlib.sha256(text.encode("utf-8")).digest()
            out.append([(seed[i % 32] - 127.5) / 127.5 for i in range(self.dims)])
        if on_batch is not None:
            on_batch(len(out))
        return out

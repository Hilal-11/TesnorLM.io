"""Embeddings (spec section 9, step "embed"): batches of 96, backoff on 429 and 5xx,
vector length checked, and a token cap per document so one huge file can't run up a bill."""

from __future__ import annotations

import random
import time
from collections.abc import Callable
from typing import Any

from app.errors import IngestError

BATCH = 96
ATTEMPTS = 5


class Embedder:
    def __init__(
        self,
        api_key: str,
        model: str,
        dims: int,
        *,
        client: Any = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        import openai

        self._openai = openai
        self._client = client or openai.OpenAI(api_key=api_key, max_retries=0, timeout=60.0)
        self.model = model
        self.dims = dims
        self._sleep = sleep
        self.tokens = 0

    def _batch(self, texts: list[str]) -> list[list[float]]:
        openai = self._openai
        retryable = (
            openai.RateLimitError,
            openai.InternalServerError,
            openai.APIConnectionError,
            openai.APITimeoutError,
        )
        for attempt in range(ATTEMPTS):
            try:
                response = self._client.embeddings.create(model=self.model, input=texts)
                break
            except retryable:
                if attempt == ATTEMPTS - 1:
                    raise
                self._sleep(min(30.0, 1.5 * (2**attempt)) + random.uniform(0, 0.5))
        vectors = [item.embedding for item in sorted(response.data, key=lambda d: d.index)]
        if len(vectors) != len(texts):
            raise RuntimeError("embedding count mismatch")
        for vector in vectors:
            if len(vector) != self.dims:
                raise RuntimeError(f"embedding has {len(vector)} dims, expected {self.dims}")
        usage = getattr(response, "usage", None)
        self.tokens += int(getattr(usage, "total_tokens", 0) or 0)
        return vectors

    def embed(
        self, texts: list[str], on_batch: Callable[[int], None] | None = None
    ) -> list[list[float]]:
        out: list[list[float]] = []
        for i in range(0, len(texts), BATCH):
            out.extend(self._batch(texts[i : i + BATCH]))
            if on_batch is not None:
                on_batch(len(out))
        return out


def check_token_budget(token_counts: list[int], cap: int) -> int:
    total = sum(token_counts)
    if total > cap:
        # Pages are capped first, so this only trips on pathological files: treat as final.
        raise IngestError("internal")
    return total

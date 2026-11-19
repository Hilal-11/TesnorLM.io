"""Figure descriptions with the fast vision model (spec section 9, step "captions").

One request per figure, `caption_concurrency` at a time. A figure that can't be described keeps
its paper caption: captions never fail a document. Token usage is summed and logged per
document (never the prompt or the answer).
"""

from __future__ import annotations

import base64
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

PROMPT_PATH = Path(__file__).parent / "prompts" / "captioner.md"
MAX_TOKENS = 2048  # short answers; thinking (always on for Haiku 5.5) shares this budget
ATTEMPTS = 3


@lru_cache(maxsize=1)
def system_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8").strip()


@dataclass
class CaptionUsage:
    input_tokens: int = 0
    output_tokens: int = 0
    described: int = 0
    failed: int = 0
    cached: int = 0
    failures: list[str] = field(default_factory=list)  # error class names only


def user_content(webp: bytes, label: str | None, paper_caption: str | None) -> list[dict[str, Any]]:
    context = f"Label: {label or 'none'}\nCaption printed in the paper: {paper_caption or 'none'}"
    return [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/webp",
                "data": base64.standard_b64encode(webp).decode("ascii"),
            },
        },
        {"type": "text", "text": context},
    ]


class Captioner:
    """Wraps the Anthropic client; `describe` returns text or None (never raises)."""

    def __init__(self, api_key: str, model: str, *, client: Any = None, sleep: Callable[[float], None] = time.sleep) -> None:
        import anthropic

        self._anthropic = anthropic
        self._client = client or anthropic.Anthropic(api_key=api_key, max_retries=2, timeout=60.0)
        self._model = model
        self._sleep = sleep

    def describe(
        self, webp: bytes, label: str | None, paper_caption: str | None, usage: CaptionUsage
    ) -> str | None:
        anthropic = self._anthropic
        for attempt in range(ATTEMPTS):
            try:
                response = self._client.messages.create(
                    model=self._model,
                    max_tokens=MAX_TOKENS,
                    output_config={"effort": "low"},
                    system=system_prompt(),
                    messages=[{"role": "user", "content": user_content(webp, label, paper_caption)}],
                )
            except (anthropic.RateLimitError, anthropic.InternalServerError, anthropic.APIConnectionError) as exc:
                usage.failures.append(type(exc).__name__)
                self._sleep(2.0 * (2**attempt))
                continue
            except anthropic.APIStatusError as exc:  # 4xx: retrying won't help
                usage.failures.append(type(exc).__name__)
                return None

            usage.input_tokens += response.usage.input_tokens
            usage.output_tokens += response.usage.output_tokens
            if response.stop_reason == "refusal":
                usage.failures.append("refusal")
                return None
            text = " ".join(b.text for b in response.content if b.type == "text").strip()
            return text or None
        return None


def caption_all(
    figures: list[dict[str, Any]],
    load_image: Callable[[dict[str, Any]], bytes],
    describe: Callable[[bytes, str | None, str | None, CaptionUsage], str | None],
    cached: Callable[[dict[str, Any]], str | None],
    save: Callable[[dict[str, Any], str], None],
    *,
    concurrency: int,
    on_done: Callable[[int, int], None] | None = None,
) -> CaptionUsage:
    """Describes every figure that has no description yet. Idempotent: done figures are skipped."""
    usage = CaptionUsage()
    todo = [f for f in figures if not f.get("description")]
    total = len(figures)
    done = total - len(todo)

    def one(figure: dict[str, Any]) -> CaptionUsage:
        # Each figure counts into its own object; the main thread merges them (no shared writes).
        mine = CaptionUsage()
        text = cached(figure)
        if text:
            mine.cached += 1
        else:
            try:
                text = describe(
                    load_image(figure), figure.get("label"), figure.get("paper_caption"), mine
                )
            except Exception as exc:  # noqa: BLE001 - one figure never fails the document
                mine.failures.append(type(exc).__name__)
                text = None
        if text:
            save(figure, text)
            mine.described += 1
        else:
            mine.failed += 1
        return mine

    with ThreadPoolExecutor(max_workers=max(1, concurrency)) as pool:
        for mine in pool.map(one, todo):
            usage.input_tokens += mine.input_tokens
            usage.output_tokens += mine.output_tokens
            usage.described += mine.described
            usage.failed += mine.failed
            usage.cached += mine.cached
            usage.failures.extend(mine.failures)
            done += 1
            if on_done is not None:
                on_done(done, total)
    return usage

"""Stage and progress reporting (spec sections 4 and 5).

- A stage change is written at once; progress within a stage at most once per second per
  document (the latest value wins and is flushed before the next stage change).
- Progress is mapped into each stage's band and never goes backwards within a run.
- Detail lines come from the contract ("Reading page 18 of 42"), never hand-written here.
- When the database refuses a write because the run is stale (re-processed or deleted), the
  reporter raises StaleRun so the step stops. A retried step that reports a stage the run has
  already passed is skipped quietly (the database never moves backwards).
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any

from app.contract import STAGE, STAGES, detail_line
from app.errors import StaleRun
from app.store import Store

# (start, end) of each stage's share of the 0–100 bar (spec section 5).
BANDS: dict[str, tuple[int, int]] = {
    STAGE.queued: (0, 0),
    STAGE.validating: (0, 5),
    STAGE.repairing: (0, 5),
    STAGE.parsing_fast: (5, 45),
    STAGE.parsing_deep: (5, 45),
    STAGE.ocr: (5, 45),
    STAGE.reading_figures: (45, 65),
    STAGE.indexing: (65, 99),
}

ORDER = {stage: i for i, stage in enumerate(STAGES)}


def band_progress(stage: str, done: int | None = None, total: int | None = None) -> int:
    start, end = BANDS.get(stage, (0, 0))
    if not done or not total or total <= 0:
        return start
    fraction = min(1.0, max(0.0, done / total))
    return start + int((end - start) * fraction)


class StageReporter:
    def __init__(
        self,
        store: Store,
        document_id: str,
        run_id: str,
        *,
        current_stage: str | None = None,
        clock: Callable[[], float] = time.monotonic,
        min_interval: float = 1.0,
    ) -> None:
        self._store = store
        self._document_id = document_id
        self._run_id = run_id
        self._clock = clock
        self._min_interval = min_interval
        self.stage = current_stage
        self.progress = 0
        self.writes = 0
        self._last_write = float("-inf")
        self._pending: tuple[int, str] | None = None

    def _behind(self, stage: str) -> bool:
        return self.stage is not None and ORDER[stage] < ORDER[self.stage]

    def _write(self, stage: str, progress: int, detail: str | None) -> None:
        self.writes += 1
        ok = self._store.set_stage(self._document_id, self._run_id, stage, progress, detail)
        self._last_write = self._clock()
        if ok:
            return
        doc = self._store.get_document(self._document_id)
        if not doc or doc.get("deleted_at") or doc.get("ingest_run_id") != self._run_id:
            raise StaleRun()
        # Same run, but the database is already further along (a retried step): adopt it.
        db_stage = doc.get("stage")
        if isinstance(db_stage, str) and db_stage in ORDER and ORDER[db_stage] >= ORDER[stage]:
            self.stage = db_stage
            return
        # A move the contract doesn't allow from where the run really is: a bug, so the step
        # fails loudly (and is retried, then logged) instead of drifting from the database.
        raise RuntimeError(f"stage {db_stage} -> {stage} refused")

    def enter(self, stage: str, n: int | None = None, of: int | None = None, **values: Any) -> None:
        """Moves to a new stage (written at once, after any pending progress). `n` of `of` is
        how far into the stage the run is; `values` fill the detail line's template."""
        if self._behind(stage):
            return
        if stage == self.stage:
            self.update(n, of, force=True, **values)
            return
        self.flush()
        self.progress = max(self.progress, band_progress(stage, n, of))
        self._write(stage, self.progress, detail_line(stage, values))
        if not self._behind(stage):
            self.stage = stage

    def update(
        self, n: int | None = None, of: int | None = None, *, force: bool = False, **values: Any
    ) -> None:
        """Progress within the current stage, throttled to one write per `min_interval`."""
        if self.stage is None or self.stage not in BANDS:
            return
        progress = max(self.progress, band_progress(self.stage, n, of))
        detail = detail_line(self.stage, values)
        self.progress = progress
        if force or self._clock() - self._last_write >= self._min_interval:
            self._pending = None
            self._write(self.stage, progress, detail)
        else:
            self._pending = (progress, detail)

    def flush(self) -> None:
        if self._pending is not None and self.stage is not None:
            progress, detail = self._pending
            self._pending = None
            self._write(self.stage, progress, detail)

    def fail(self, code: str, values: dict[str, Any] | None = None) -> bool:
        self._pending = None
        return self._store.set_stage(
            self._document_id, self._run_id, STAGE.failed, None, None, code, values or None
        )

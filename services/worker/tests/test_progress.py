import pytest

from app.errors import StaleRun
from app.progress import BANDS, StageReporter, band_progress
from fakes import FakeStore


class Clock:
    def __init__(self) -> None:
        self.t = 0.0

    def __call__(self) -> float:
        return self.t


def setup(stage="queued"):
    store = FakeStore()
    doc = store.add_document(b"%PDF-1.4", stage=stage)
    clock = Clock()
    rep = StageReporter(store, doc["id"], doc["ingest_run_id"], current_stage=stage, clock=clock)
    return store, doc, clock, rep


def test_bands_match_the_spec():
    assert BANDS["validating"] == (0, 5)
    assert BANDS["repairing"] == (0, 5)
    assert BANDS["parsing_fast"] == BANDS["parsing_deep"] == BANDS["ocr"] == (5, 45)
    assert BANDS["reading_figures"] == (45, 65)
    assert BANDS["indexing"] == (65, 99)
    assert band_progress("parsing_deep", 21, 42) == 25
    assert band_progress("indexing", 10, 10) == 99
    assert band_progress("parsing_deep", None, None) == 5


def test_progress_updates_are_throttled_to_one_per_second_but_stage_changes_are_immediate():
    store, doc, clock, rep = setup()
    rep.enter("validating")
    rep.enter("parsing_deep")
    assert store.writes == 2  # two stage changes, written at once
    for page in range(1, 43):
        clock.t += 0.05  # 42 pages in ~2 s
        rep.update(page, 42, page=page, pages=42)
    # ≤ 1 write per second: ~2 progress writes, never one per page
    progress_writes = store.writes - 2
    assert 1 <= progress_writes <= 3
    rep.enter("indexing", 0, 10, passages=10)
    # the pending "page 42" update was flushed before the stage change
    details = [d for _, s, _, d in store.stage_log if s == "parsing_deep"]
    assert details[-1] == "Reading tables and figures · page 42 of 42"
    assert store.documents[doc["id"]]["stage_detail"] == "Indexing 10 passages"


def test_progress_never_goes_backwards():
    store, doc, clock, rep = setup()
    rep.enter("validating")
    rep.enter("parsing_deep")
    rep.update(30, 40, force=True, page=30, pages=40)
    high = store.documents[doc["id"]]["progress"]
    rep.update(5, 40, force=True, page=5, pages=40)
    assert store.documents[doc["id"]]["progress"] == high
    progresses = [p for _, _, p, _ in store.stage_log]
    assert progresses == sorted(progresses)


def test_detail_lines_are_honest_counts():
    store, doc, clock, rep = setup()
    rep.enter("validating")
    rep.enter("parsing_deep")
    rep.update(18, 42, force=True, page=18, pages=42)
    assert store.documents[doc["id"]]["stage_detail"] == "Reading tables and figures · page 18 of 42"
    rep.enter("reading_figures", 0, 9, done=3, total=9)
    assert store.documents[doc["id"]]["stage_detail"] == "Reading figures · 3 of 9"
    rep.enter("indexing", 0, 128, passages=128)
    assert store.documents[doc["id"]]["stage_detail"] == "Indexing 128 passages"


def test_missing_counts_use_the_fallback():
    store, doc, clock, rep = setup()
    rep.enter("validating")
    rep.enter("parsing_deep")
    assert store.documents[doc["id"]]["stage_detail"] == "Reading tables and figures"


def test_a_stale_run_stops_the_reporter():
    store, doc, clock, rep = setup()
    rep.enter("validating")
    store.new_run(doc["id"])  # re-processed meanwhile
    with pytest.raises(StaleRun):
        rep.enter("parsing_deep")


def test_a_deleted_document_stops_the_reporter():
    store, doc, clock, rep = setup()
    rep.enter("validating")
    store.documents[doc["id"]]["deleted_at"] = "2026-11-20T00:00:00Z"
    with pytest.raises(StaleRun):
        rep.update(1, 1, force=True)


def test_a_retried_step_never_moves_the_document_backwards():
    store, doc, clock, rep = setup(stage="ocr")
    rep.enter("parsing_deep")  # retry of the parse step after OCR had started
    assert store.documents[doc["id"]]["stage"] == "ocr"
    rep.enter("ocr")
    rep.update(1, 2, force=True, page=1, pages=2)
    assert store.documents[doc["id"]]["stage_detail"] == "Running OCR on page 1 of 2"


def test_fail_records_the_code_and_values():
    store, doc, clock, rep = setup()
    rep.enter("validating")
    assert rep.fail("file_too_large", {"sizeMb": "120", "limitMb": "50"})
    d = store.documents[doc["id"]]
    assert (d["stage"], d["error_code"], d["error_vars"]) == ("failed", "file_too_large", {"sizeMb": "120", "limitMb": "50"})


def test_an_illegal_jump_raises_instead_of_drifting():
    store, doc, clock, rep = setup()
    with pytest.raises(RuntimeError):
        rep.enter("indexing")  # queued -> indexing isn't in the contract
    assert store.documents[doc["id"]]["stage"] == "queued"

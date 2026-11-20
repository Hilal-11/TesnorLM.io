"""The whole ingest-document pipeline on real Docling output, with an in-memory store.

Marked `docling`: the first run loads the layout and table models (about a minute).
"""

from __future__ import annotations

from typing import Any

import pytest

from app import parse
from app.contract import STAGES, STORAGE, can_transition
from app.errors import StaleRun
from app.pipeline import (
    Deps,
    Run,
    run_all,
    step_captions,
    step_figures,
    step_finalize,
    step_index,
    step_parse,
    step_validate,
)
from app.settings import get_settings
from fakes import FakeCaptioner, FakeEmbedder, FakeStore

pytestmark = pytest.mark.docling


def make(store: FakeStore, **kw: Any) -> Deps:
    return Deps(
        store=store,
        settings=get_settings(),
        embedder=kw.get("embedder") or FakeEmbedder(),
        captioner=kw.get("captioner", FakeCaptioner()),
    )


def plain_step(name, fn):
    return fn()


def ingest(pdf: bytes, **kw: Any):
    store = FakeStore()
    doc = store.add_document(pdf, title="A Tiny Study of Attention")
    deps = make(store, **kw)
    run = Run(doc["id"], doc["ingest_run_id"])
    result = run_all(deps, run, plain_step)
    return store, doc, deps, run, result


@pytest.fixture(scope="module")
def basic(pdf_bytes):
    return ingest(pdf_bytes["paper_basic"])


def test_paper_basic_becomes_ready(basic):
    store, doc, deps, run, result = basic
    assert result == {"ready": True}
    d = store.documents[doc["id"]]
    assert d["stage"] == "ready"
    assert d["progress"] == 100
    assert d["ready_run_id"] == run.run_id
    assert d["page_count"] == 3
    assert d["ocr_used"] is False
    assert d["parser_version"].startswith("docling ")
    assert d["embedding_model"] == get_settings().embedding_model
    assert d["markdown"] and "Tiny Study" in d["markdown"]


def test_paper_basic_chunks_are_page_aware(basic):
    store, doc, *_ = basic
    chunks = store.chunks_for(doc["id"])
    assert len(chunks) > 0
    pages = store.documents[doc["id"]]["page_count"]
    for c in chunks:
        assert 1 <= c["page_start"] <= c["page_end"] <= pages
        assert c["bboxes"], c["chunk_index"]
        for box in c["bboxes"]:
            assert 1 <= box["page"] <= pages
            assert box["l"] <= box["r"] and box["t"] <= box["b"]  # top-left origin
        assert c["token_count"] > 0
        assert len(c["embedding"]) == 1536
    assert any(c["headings"] for c in chunks if c["kind"] == "text")
    assert sum(1 for c in chunks if c["kind"] == "table") >= 1
    captions = [c for c in chunks if c["kind"] == "figure_caption"]
    assert len(captions) == 2
    figure_ids = {f["id"] for f in store.figures.values()}
    assert {c["figure_id"] for c in captions} == figure_ids
    assert captions[0]["content"].startswith("Figure 1 (page 1): Scaled dot-product attention")


def test_running_headers_and_page_numbers_are_filtered(basic):
    store, doc, *_ = basic
    for c in store.chunks_for(doc["id"]):
        assert "Preprint" not in c["content"]
        assert c["content"].strip() not in {"1", "2", "3"}


def test_embedding_text_is_contextual(basic):
    store, doc, deps, *_ = basic
    text_chunk = next(c for c in store.chunks_for(doc["id"]) if c["kind"] == "text" and c["headings"])
    sent = [t for t in deps.embedder.texts if text_chunk["content"][:40] in t]
    assert sent and sent[0].startswith("Document: A Tiny Study of Attention\n")
    assert text_chunk["headings"][-1] in sent[0]


def test_figures_are_stored_with_positions_and_captions(basic):
    store, doc, deps, run, _ = basic
    figures = store.figures_for_run(doc["id"], run.run_id)
    assert [f["label"] for f in figures] == ["Figure 1", "Figure 2"]
    for f in figures:
        assert f["image_path"] == f"{doc['user_id']}/{doc['id']}/figures/{run.run_id}/{f['ordinal']}.webp"
        image = store.objects[(STORAGE.bucket, f["image_path"])]
        assert image[:4] == b"RIFF" and image[8:12] == b"WEBP"
        assert f["width"] <= 1600
        assert f["bbox"]["page"] == f["page"]
        assert f["description"].startswith("A described figure")
        assert f["paper_caption"].startswith(f["label"])


def test_stage_order_matches_the_contract(basic):
    store, doc, *_ = basic
    stages = store.stages(doc["id"])
    assert stages == ["validating", "parsing_deep", "reading_figures", "indexing", "ready"]
    full = ["queued", *stages]
    for a, b in zip(full, full[1:]):
        assert b == "ready" or can_transition(a, b)
    assert [s for s in STAGES if s in stages] == stages  # contract order
    progresses = [p for d, _, p, _ in store.stage_log if d == doc["id"]]
    assert progresses == sorted(progresses)


def test_detail_lines_were_honest(basic):
    store, doc, *_ = basic
    details = [d for doc_id, _, _, d in store.stage_log if doc_id == doc["id"] and d]
    assert "Reading tables and figures · page 3 of 3" in details
    assert any(d.startswith("Reading figures · ") and d.endswith(" of 2") for d in details)
    assert any(d.startswith("Indexing ") and d.endswith(" passages") for d in details)


def test_parsed_document_is_saved_for_retries(basic):
    store, doc, deps, run, _ = basic
    path = f"{doc['user_id']}/{doc['id']}/{run.run_id}/doc.json"
    assert (STORAGE.artifacts_bucket, path) in store.objects


def test_every_step_is_idempotent(pdf_bytes):
    store = FakeStore()
    doc = store.add_document(pdf_bytes["paper_basic"])
    deps = make(store)
    run = Run(doc["id"], doc["ingest_run_id"])
    validated = step_validate(deps, run)
    assert step_validate(deps, run) == validated
    calls = []
    deps.convert = lambda *a, **k: calls.append(1) or parse.convert(*a, **k)
    step_parse(deps, run, validated["pages"], validated["scanned"])
    assert step_parse(deps, run, validated["pages"], validated["scanned"])["cached"] is True
    assert len(calls) == 1  # a retry after parsing never parses again
    step_figures(deps, run)
    step_figures(deps, run)
    assert len(store.figures) == 2
    step_captions(deps, run)
    captioned = deps.captioner.calls
    step_captions(deps, run)
    assert deps.captioner.calls == captioned  # done figures are skipped
    step_index(deps, run)
    n = len(store.chunks)
    embed_calls = deps.embedder.calls
    step_index(deps, run)
    assert len(store.chunks) == n
    assert deps.embedder.calls == embed_calls  # nothing left to embed
    assert step_finalize(deps, run) == {"ready": True}
    assert step_finalize(deps, run) == {"ready": True}
    assert store.documents[doc["id"]]["chunk_count"] == n


def test_a_reprocess_mid_run_stops_the_old_run_without_writes(pdf_bytes):
    store = FakeStore()
    doc = store.add_document(pdf_bytes["paper_basic"])
    deps = make(store)
    old = Run(doc["id"], doc["ingest_run_id"])

    def reprocess_when_indexing(document_id, stage):
        if stage == "indexing" and store.documents[document_id]["ingest_run_id"] == old.run_id:
            store.new_run(document_id)

    store.on_set_stage = reprocess_when_indexing
    result = run_all(deps, old, plain_step)
    assert result == {"stop": "stale"}
    d = store.documents[doc["id"]]
    assert d["stage"] == "queued" and d["ingest_run_id"] != old.run_id
    assert not any(k[1] == old.run_id for k in store.chunks)
    with pytest.raises(StaleRun):  # a stale run can't finalize, through the step or the RPC
        step_finalize(deps, old)
    assert store.finalize(doc["id"], old.run_id, None, None) is False


def test_a_failed_caption_keeps_the_figure(pdf_bytes):
    store, doc, deps, run, result = ingest(pdf_bytes["paper_basic"], captioner=FakeCaptioner({2}))
    assert result == {"ready": True}
    figures = store.figures_for_run(doc["id"], run.run_id)
    assert figures[1]["description"] is None
    caption = next(c for c in store.chunks_for(doc["id"]) if c["figure_id"] == figures[1]["id"])
    assert caption["content"] == "Figure 2 (page 2): Accuracy grows with the number of layers."


def test_without_a_caption_model_figures_keep_their_paper_caption(pdf_bytes):
    store, doc, deps, run, result = ingest(pdf_bytes["paper_basic"], captioner=None)
    assert result == {"ready": True}
    assert all(f["description"] is None for f in store.figures.values())


def test_born_digital_pdf_does_not_use_ocr(basic):
    store, doc, *_ = basic
    assert "ocr" not in store.stages(doc["id"])
    assert store.documents[doc["id"]]["ocr_used"] is False


def test_scanned_pdf_runs_ocr_and_is_searchable(pdf_bytes):
    from fixtures.make_fixtures import KNOWN_SCANNED_WORD

    store, doc, deps, run, result = ingest(pdf_bytes["scanned"])
    assert result == {"ready": True}
    assert store.stages(doc["id"]) == ["validating", "parsing_deep", "ocr", "indexing", "ready"]
    details = [d for _, s, _, d in store.stage_log if s == "ocr"]
    assert "Running OCR on page 1 of 1" in details
    assert store.documents[doc["id"]]["ocr_used"] is True
    assert any(KNOWN_SCANNED_WORD in c["content"].upper() for c in store.chunks_for(doc["id"]))


def test_blank_scan_fails_with_no_text_after_ocr(pdf_bytes):
    store, doc, deps, run, result = ingest(pdf_bytes["blank_scan"])
    assert result == {"stop": "failed", "code": "no_text_after_ocr"}
    assert store.documents[doc["id"]]["error_code"] == "no_text_after_ocr"
    assert not store.chunks


@pytest.mark.parametrize(
    ("name", "code"),
    [("not_pdf", "unsupported_type"), ("corrupt", "unreadable_after_repair")],
)
def test_unreadable_files_fail_cleanly(pdf_bytes, name, code):
    store, doc, deps, run, result = ingest(pdf_bytes[name])
    assert result == {"stop": "failed", "code": code}
    d = store.documents[doc["id"]]
    assert (d["stage"], d["error_code"]) == ("failed", code)
    assert store.stages(doc["id"]) == ["validating", "failed"]


def test_a_password_locked_pdf_waits_instead_of_failing(pdf_bytes):
    store, doc, deps, run, result = ingest(pdf_bytes["encrypted"])
    assert result == {"stop": "needs_password"}
    d = store.documents[doc["id"]]
    assert (d["stage"], d["error_code"]) == ("needs_password", None)
    assert store.stages(doc["id"]) == ["validating", "needs_password"]


def test_a_long_pdf_is_read_up_to_max_pages(pdf_bytes):
    store = FakeStore()
    doc = store.add_document(pdf_bytes["too_many_pages"])
    deps = make(store)
    deps.settings = deps.settings.model_copy(update={"max_pages": 3})
    run = Run(doc["id"], doc["ingest_run_id"])
    validated = step_validate(deps, run)
    assert (validated["pages"], validated["total_pages"]) == (3, 201)
    assert store.documents[doc["id"]]["page_count"] == 3
    seen = {}
    deps.convert = lambda *a, **k: seen.update(k) or parse.convert(*a, **k)
    step_parse(deps, run, validated["pages"], validated["scanned"])
    assert seen["max_pages"] == 3
    parsed = parse.from_json(
        store.objects[(STORAGE.artifacts_bucket, f"{doc['user_id']}/{doc['id']}/{run.run_id}/doc.json")]
    )
    assert len(parsed.pages) == 3


def test_repeated_logos_are_skipped(pdf_bytes):
    store, doc, deps, run, result = ingest(pdf_bytes["logo_repeat"])
    assert result == {"ready": True}
    assert [f["label"] for f in store.figures.values()] == ["Figure 1"]


def test_parse_timeout_is_final(pdf_bytes, monkeypatch):
    from app.errors import IngestError

    store = FakeStore()
    doc = store.add_document(pdf_bytes["paper_basic"])
    deps = make(store)

    def slow(*a, **k):
        raise IngestError("parse_timeout")

    deps.convert = slow
    result = run_all(deps, Run(doc["id"], doc["ingest_run_id"]), plain_step)
    assert result == {"stop": "failed", "code": "parse_timeout"}


def test_unexpected_errors_propagate_for_the_queue_to_retry(pdf_bytes):
    store = FakeStore()
    doc = store.add_document(pdf_bytes["paper_basic"])
    deps = make(store)
    deps.convert = lambda *a, **k: (_ for _ in ()).throw(MemoryError())
    with pytest.raises(MemoryError):
        run_all(deps, Run(doc["id"], doc["ingest_run_id"]), plain_step)
    assert store.documents[doc["id"]]["stage"] == "parsing_deep"  # not failed: the queue retries


def test_parallel_conversions_are_serialized(pdfs):
    """Two ingests parse at once under load; unguarded, Docling crashes the process."""
    from concurrent.futures import ThreadPoolExecutor

    def convert(name):
        return len(parse.convert(pdfs[name], ocr=False, timeout_s=600).pages)

    with ThreadPoolExecutor(3) as pool:
        assert list(pool.map(convert, ["paper_basic", "logo_repeat", "paper_basic"])) == [3, 4, 3]

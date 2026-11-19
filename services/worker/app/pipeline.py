"""The ingest-document steps (spec section 9).

Each step is one Inngest step: it starts with the current-run guard, can run twice for the same
run without duplicating anything, and returns a small JSON result. Final problems (a bad file,
a timeout) become a failed document with a contract error code; unexpected exceptions propagate
so the queue retries the step, and only after the last retry does the document fail as
`internal` (see app/queue.py).
"""

from __future__ import annotations

import tempfile
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app import chunking, figures, parse
from app.captions import Captioner, caption_all
from app.contract import STORAGE, storage_path
from app.embed import Embedder, check_token_budget
from app.errors import IngestError, StaleRun
from app.log import get_log
from app.progress import StageReporter
from app.settings import Settings
from app.store import Store
from app.validate import check_size, validate_pdf

log = get_log("pipeline")

StepResult = dict[str, Any]


@dataclass
class Deps:
    store: Store
    settings: Settings
    embedder: Embedder
    captioner: Captioner | None
    convert: Callable[..., Any] = parse.convert
    clock: Callable[[], float] = time.monotonic


@dataclass(frozen=True)
class Run:
    document_id: str
    run_id: str


# ───────────── guard and helpers ─────────────


def current(store: Store, run: Run) -> dict[str, Any]:
    """The document, or StaleRun when it was deleted or re-processed since this run began."""
    doc = store.get_document(run.document_id)
    if not doc or doc.get("deleted_at") or doc.get("ingest_run_id") != run.run_id:
        raise StaleRun()
    return doc


def reporter(deps: Deps, run: Run, doc: dict[str, Any]) -> StageReporter:
    return StageReporter(
        deps.store, run.document_id, run.run_id, current_stage=doc.get("stage"), clock=deps.clock
    )


def parsed_path(doc: dict[str, Any], run: Run) -> str:
    return storage_path(
        "parsed", {"userId": doc["user_id"], "documentId": run.document_id, "runId": run.run_id}
    )


def download_source(deps: Deps, doc: dict[str, Any], folder: Path) -> Path:
    size = deps.store.object_size(STORAGE.bucket, doc["storage_path"])
    if size is None:
        raise IngestError("upload_interrupted")
    check_size(size, deps.settings.max_upload_bytes)
    data = deps.store.download(STORAGE.bucket, doc["storage_path"])
    check_size(len(data), deps.settings.max_upload_bytes)
    path = folder / "source.pdf"
    path.write_bytes(data)
    return path


def load_parsed(deps: Deps, doc: dict[str, Any], run: Run) -> Any:
    return parse.from_json(deps.store.download(STORAGE.artifacts_bucket, parsed_path(doc, run)))


def guarded(step: str, deps: Deps, run: Run, fn: Callable[[], StepResult]) -> StepResult:
    """Runs a step: a stale run stops quietly, a final error fails the document."""
    started = deps.clock()
    fields = {"document_id": run.document_id, "run_id": run.run_id, "step": step}
    try:
        result = fn()
    except StaleRun:
        log.info("run is stale, stopping", **fields)
        return {"stop": "stale"}
    except IngestError as exc:
        failed = deps.store.set_stage(
            run.document_id, run.run_id, "failed", None, None, exc.code, exc.values or None
        )
        log.info("ingest failed", error_code=exc.code, recorded=failed, **fields)
        return {"stop": "failed", "code": exc.code}
    log.info("step done", duration_ms=round((deps.clock() - started) * 1000), **fields, **{
        k: v for k, v in result.items() if isinstance(v, (int, bool)) and k != "stop"
    })
    return result


# ───────────── steps ─────────────


def step_validate(deps: Deps, run: Run) -> StepResult:
    doc = current(deps.store, run)
    stages = reporter(deps, run, doc)
    stages.enter("validating")
    with tempfile.TemporaryDirectory(prefix="tensorlm-") as tmp:
        path = download_source(deps, doc, Path(tmp))
        info = validate_pdf(
            path, max_bytes=deps.settings.max_upload_bytes, max_pages=deps.settings.max_pages
        )
    if not deps.store.update_document(
        run.document_id,
        run.run_id,
        {
            "page_count": info.pages,
            "file_size": info.size,
            "sha256": info.sha256,
            "parser_version": parse.parser_version(),
            "embedding_model": deps.settings.embedding_model,
        },
    ):
        raise StaleRun()
    stages.update(1, 1)
    stages.flush()
    return {"pages": info.pages, "scanned": info.scanned_pages}


def step_parse(deps: Deps, run: Run, pages: int, scanned: list[int]) -> StepResult:
    doc = current(deps.store, run)
    artifact = parsed_path(doc, run)
    if deps.store.object_size(STORAGE.artifacts_bucket, artifact) is not None:
        return {"cached": True, "ocr_used": bool(doc.get("ocr_used"))}

    stages = reporter(deps, run, doc)
    ocr = bool(scanned)
    stages.enter("parsing")
    if ocr:
        stages.enter("ocr")
    scanned_set = set(scanned)
    finished: set[int] = set()
    lock = threading.Lock()

    def on_page(done: int, total: int, page_no: int) -> None:
        # Docling reports from its own threads; the reporter isn't thread-safe.
        with lock:
            finished.add(page_no)
            if ocr:
                ocr_done = len(finished & scanned_set)
                stages.update(done, total, page=max(1, ocr_done), pages=len(scanned_set))
            else:
                stages.update(done, total, page=done, pages=total)

    with tempfile.TemporaryDirectory(prefix="tensorlm-") as tmp:
        path = download_source(deps, doc, Path(tmp))
        parsed = deps.convert(path, ocr=ocr, timeout_s=deps.settings.parse_timeout_s, on_page=on_page)
    if not parse.has_text(parsed):
        raise IngestError("no_text_found")
    deps.store.upload(STORAGE.artifacts_bucket, artifact, parse.to_json(parsed), "application/json")
    if not deps.store.update_document(run.document_id, run.run_id, {"ocr_used": ocr}):
        raise StaleRun()
    with lock:
        stages.update(pages, pages, page=len(scanned_set) or pages, pages=len(scanned_set) or pages)
        stages.flush()
    return {"ocr_used": ocr, "pictures": len(parsed.pictures)}


def step_figures(deps: Deps, run: Run) -> StepResult:
    doc = current(deps.store, run)
    parsed = load_parsed(deps, doc, run)
    saved, skipped = figures.extract(parsed, deps.settings.max_figures)
    if not saved:
        return {"figures": 0, "skipped": skipped}
    stages = reporter(deps, run, doc)
    stages.enter("reading_figures", 0, len(saved), done=0, total=len(saved))
    rows = []
    for figure in saved:
        path = storage_path(
            "figure",
            {
                "userId": doc["user_id"],
                "documentId": run.document_id,
                "runId": run.run_id,
                "n": figure.ordinal,
            },
        )
        deps.store.upload(STORAGE.bucket, path, figure.webp, "image/webp")
        rows.append(
            {
                "document_id": run.document_id,
                "ingest_run_id": run.run_id,
                "ordinal": figure.ordinal,
                "user_id": doc["user_id"],
                "page": figure.page,
                "image_path": path,
                "label": figure.label,
                "paper_caption": figure.paper_caption,
                "bbox": figure.bbox,
                "width": figure.width,
                "height": figure.height,
                "image_sha256": figure.image_sha256,
            }
        )
    current(deps.store, run)  # don't write rows for a run that was cancelled meanwhile
    deps.store.upsert_figures(rows)
    return {"figures": len(saved), "skipped": skipped}


def step_captions(deps: Deps, run: Run) -> StepResult:
    doc = current(deps.store, run)
    rows = deps.store.figures_for_run(run.document_id, run.run_id)
    if not rows or deps.captioner is None:
        return {"described": 0, "failed": 0}
    stages = reporter(deps, run, doc)
    stages.enter("reading_figures")
    captioner = deps.captioner

    def save(figure: dict[str, Any], text: str) -> None:
        deps.store.update_figure(figure["id"], {"description": text})

    usage = caption_all(
        rows,
        load_image=lambda f: deps.store.download(STORAGE.bucket, f["image_path"]),
        describe=captioner.describe,
        cached=lambda f: deps.store.cached_description(doc["user_id"], f["image_sha256"])
        if f.get("image_sha256")
        else None,
        save=save,
        concurrency=deps.settings.caption_concurrency,
        on_done=lambda done, total: stages.update(done, total, done=done, total=total),
    )
    stages.flush()
    log.info(
        "caption usage",
        document_id=run.document_id,
        run_id=run.run_id,
        model=deps.settings.fast_model,
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
        described=usage.described,
        cached=usage.cached,
        failed=usage.failed,
        failure_types=sorted(set(usage.failures)),
    )
    return {"described": usage.described, "failed": usage.failed, "cached": usage.cached}


def step_index(deps: Deps, run: Run) -> StepResult:
    doc = current(deps.store, run)
    parsed = load_parsed(deps, doc, run)
    figure_rows = deps.store.figures_for_run(run.document_id, run.run_id)
    page_count = int(doc.get("page_count") or len(parsed.pages) or 1)
    title = doc.get("title") or "Untitled"
    rows = chunking.build_chunks(parsed, title, page_count, figure_rows)
    if not rows:
        raise IngestError("no_text_found")
    check_token_budget([r.token_count for r in rows], deps.settings.max_document_tokens)

    stages = reporter(deps, run, doc)
    total = len(rows)
    stages.enter("indexing", 0, total, passages=total)
    done_already = deps.store.embedded_chunk_indexes(run.document_id, run.run_id)
    todo = [r for r in rows if r.chunk_index not in done_already]

    written = total - len(todo)
    for i in range(0, len(todo), 96):
        batch = todo[i : i + 96]
        vectors = deps.embedder.embed([r.embed_text for r in batch])
        current(deps.store, run)
        deps.store.upsert_chunks(
            [
                {
                    "document_id": run.document_id,
                    "notebook_id": doc["notebook_id"],
                    "ingest_run_id": run.run_id,
                    "chunk_index": r.chunk_index,
                    "section": r.section,
                    "content": r.content,
                    "kind": r.kind,
                    "page_start": r.page_start,
                    "page_end": r.page_end,
                    "bboxes": r.bboxes,
                    "headings": r.headings,
                    "token_count": r.token_count,
                    "figure_id": r.figure_id,
                    "embedding": vector,
                }
                for r, vector in zip(batch, vectors, strict=True)
            ]
        )
        written += len(batch)
        stages.update(written, total, passages=total)
    stages.flush()
    return {
        "chunks": total,
        "tables": sum(1 for r in rows if r.kind == "table"),
        "figure_chunks": sum(1 for r in rows if r.kind == "figure_caption"),
        "embedding_tokens": deps.embedder.tokens,
    }


def step_finalize(deps: Deps, run: Run) -> StepResult:
    doc = current(deps.store, run)
    parsed = load_parsed(deps, doc, run)
    markdown = parse.to_markdown(parsed)
    ok = deps.store.finalize(
        run.document_id, run.run_id, markdown, chunking.count_tokens(markdown)
    )
    if not ok:
        current(deps.store, run)  # stale → StaleRun; otherwise something's wrong: retry
        raise RuntimeError("finalize_ingest refused the current run")
    return {"ready": True}


STEPS: list[tuple[str, Callable[..., StepResult]]] = [
    ("validate", step_validate),
    ("parse", step_parse),
    ("figures", step_figures),
    ("captions", step_captions),
    ("index", step_index),
    ("finalize", step_finalize),
]


def run_all(deps: Deps, run: Run, step: Callable[[str, Callable[[], StepResult]], StepResult]) -> StepResult:
    """Runs the steps in order through `step` (Inngest's step.run, or a plain call in tests)."""

    def call(name: str, fn: Callable[[], StepResult]) -> StepResult:
        return step(name, lambda: guarded(name, deps, run, fn))

    validated = call("validate", lambda: step_validate(deps, run))
    if "stop" in validated:
        return validated
    parsed = call(
        "parse", lambda: step_parse(deps, run, validated["pages"], validated["scanned"])
    )
    if "stop" in parsed:
        return parsed
    for name, fn in (
        ("figures", step_figures),
        ("captions", step_captions),
        ("index", step_index),
        ("finalize", step_finalize),
    ):
        result = call(name, lambda fn=fn: fn(deps, run))
        if "stop" in result:
            return result
    return {"ready": True}


def fail_internal(store: Store, run: Run, reason: str) -> bool:
    """After the last retry: the document fails as `internal` (logged with ids, not text)."""
    ok = store.set_stage(run.document_id, run.run_id, "failed", None, None, "internal", None)
    log.error(
        "ingest failed after retries",
        document_id=run.document_id,
        run_id=run.run_id,
        error_code="internal",
        reason=reason,
        recorded=ok,
    )
    return ok

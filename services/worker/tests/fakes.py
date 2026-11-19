"""In-memory stand-ins for Supabase, OpenAI and Anthropic.

FakeStore mirrors the SQL rules of migration 0004 that the pipeline relies on:
set_document_stage() (stale runs, contract transitions, no backwards progress, never "ready"),
finalize_ingest() (atomic swap, false for stale runs) and the upsert keys of chunks and figures.
"""

from __future__ import annotations

import copy
import hashlib
import threading
import uuid
from typing import Any

from app.contract import can_transition


class FakeStore:
    def __init__(self) -> None:
        self.documents: dict[str, dict[str, Any]] = {}
        self.objects: dict[tuple[str, str], bytes] = {}
        self.figures: dict[tuple[str, str, int], dict[str, Any]] = {}
        self.chunks: dict[tuple[str, str, int], dict[str, Any]] = {}
        self.stage_log: list[tuple[str, str, int | None, str | None]] = []  # (doc, stage, progress, detail)
        self.writes = 0
        self.uploads = 0
        self._lock = threading.Lock()
        self.on_set_stage: Any = None  # hook for tests (e.g. re-process mid-run)

    # ───────── setup helpers ─────────

    def add_document(self, pdf: bytes, *, title: str = "Test paper", stage: str = "queued") -> dict[str, Any]:
        doc_id, run_id, user_id = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
        doc = {
            "id": doc_id,
            "user_id": user_id,
            "notebook_id": str(uuid.uuid4()),
            "title": title,
            "storage_path": f"{user_id}/{doc_id}/source.pdf",
            "ingest_run_id": run_id,
            "ready_run_id": None,
            "deleted_at": None,
            "stage": stage,
            "progress": 0,
            "stage_detail": None,
            "error_code": None,
            "error_vars": None,
            "page_count": None,
            "sha256": None,
            "file_size": len(pdf),
            "ocr_used": False,
            "chunk_count": 0,
            "figure_count": 0,
            "markdown": None,
        }
        self.documents[doc_id] = doc
        self.objects[("documents", doc["storage_path"])] = pdf
        return doc

    def new_run(self, doc_id: str) -> str:
        """What start_ingest_run() does for a re-process."""
        run_id = str(uuid.uuid4())
        self.documents[doc_id].update(ingest_run_id=run_id, stage="queued", progress=0, error_code=None)
        return run_id

    def stages(self, doc_id: str) -> list[str]:
        seen: list[str] = []
        for d, stage, _, _ in self.stage_log:
            if d == doc_id and (not seen or seen[-1] != stage):
                seen.append(stage)
        return seen

    # ───────── Store protocol ─────────

    def get_document(self, document_id: str) -> dict[str, Any] | None:
        doc = self.documents.get(document_id)
        return copy.deepcopy(doc) if doc else None

    def update_document(self, document_id: str, run_id: str, fields: dict[str, Any]) -> bool:
        with self._lock:
            doc = self.documents.get(document_id)
            if not doc or doc["ingest_run_id"] != run_id or doc["deleted_at"]:
                return False
            self.writes += 1
            doc.update(fields)
            return True

    def set_stage(self, document_id, run_id, stage, progress=None, detail=None, error_code=None, error_vars=None) -> bool:
        if self.on_set_stage is not None:
            self.on_set_stage(document_id, stage)
        with self._lock:
            doc = self.documents.get(document_id)
            if not doc or doc["ingest_run_id"] != run_id or doc["deleted_at"]:
                return False
            new_progress = max(doc["progress"], progress if progress is not None else doc["progress"])
            if stage == doc["stage"]:
                if stage in ("ready", "failed"):
                    return False
                doc["progress"] = min(100, new_progress)
                if detail is not None:
                    doc["stage_detail"] = detail
                self.writes += 1
                self.stage_log.append((document_id, stage, doc["progress"], doc["stage_detail"]))
                return True
            if stage == "ready" or not can_transition(doc["stage"], stage):
                return False
            doc["stage"] = stage
            if stage == "failed":
                doc.update(error_code=error_code or "internal", error_vars=error_vars, stage_detail=None)
            else:
                doc.update(progress=min(100, new_progress), stage_detail=detail)
            self.writes += 1
            self.stage_log.append((document_id, stage, doc["progress"], doc["stage_detail"]))
            return True

    def finalize(self, document_id, run_id, markdown, token_count) -> bool:
        with self._lock:
            doc = self.documents.get(document_id)
            if not doc or doc["ingest_run_id"] != run_id or doc["deleted_at"]:
                return False
            if doc["stage"] not in ("indexing", "ready"):
                return False
            for store in (self.chunks, self.figures):
                for key in [k for k in store if k[0] == document_id and k[1] != run_id]:
                    del store[key]
            if doc["stage"] == "ready":
                return True
            doc.update(
                stage="ready",
                ready_run_id=run_id,
                progress=100,
                stage_detail=None,
                markdown=markdown,
                token_count=token_count,
                chunk_count=sum(1 for k in self.chunks if k[0] == document_id),
                figure_count=sum(1 for k in self.figures if k[0] == document_id),
            )
            self.stage_log.append((document_id, "ready", 100, None))
            return True

    def object_size(self, bucket: str, path: str) -> int | None:
        data = self.objects.get((bucket, path))
        return None if data is None else len(data)

    def download(self, bucket: str, path: str) -> bytes:
        return self.objects[(bucket, path)]

    def upload(self, bucket: str, path: str, data: bytes, content_type: str) -> None:
        with self._lock:
            self.uploads += 1
            self.objects[(bucket, path)] = data

    def upsert_figures(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out = []
        with self._lock:
            for row in rows:
                key = (row["document_id"], row["ingest_run_id"], row["ordinal"])
                existing = self.figures.get(key)
                merged = {"description": None, **(existing or {}), **row}
                merged.setdefault("id", existing["id"] if existing else str(uuid.uuid4()))
                if existing:
                    merged["id"] = existing["id"]
                self.figures[key] = merged
                out.append(copy.deepcopy(merged))
        return out

    def figures_for_run(self, document_id: str, run_id: str) -> list[dict[str, Any]]:
        rows = [copy.deepcopy(f) for k, f in self.figures.items() if k[0] == document_id and k[1] == run_id]
        return sorted(rows, key=lambda f: f["ordinal"])

    def update_figure(self, figure_id: str, fields: dict[str, Any]) -> None:
        with self._lock:
            for f in self.figures.values():
                if f["id"] == figure_id:
                    f.update(fields)

    def cached_description(self, user_id: str, image_sha256: str) -> str | None:
        for f in self.figures.values():
            if f["user_id"] == user_id and f.get("image_sha256") == image_sha256 and f.get("description"):
                return f["description"]
        return None

    def upsert_chunks(self, rows: list[dict[str, Any]]) -> None:
        with self._lock:
            for row in rows:
                self.chunks[(row["document_id"], row["ingest_run_id"], row["chunk_index"])] = dict(row)

    def embedded_chunk_indexes(self, document_id: str, run_id: str) -> set[int]:
        return {
            k[2] for k, c in self.chunks.items() if k[0] == document_id and k[1] == run_id and c.get("embedding")
        }

    def chunks_for(self, document_id: str) -> list[dict[str, Any]]:
        return sorted(
            (c for k, c in self.chunks.items() if k[0] == document_id), key=lambda c: c["chunk_index"]
        )


class FakeEmbedder:
    """Deterministic 1536-dim vectors from the text hash."""

    model = "fake-embedding"
    dims = 1536

    def __init__(self) -> None:
        self.calls = 0
        self.tokens = 0
        self.texts: list[str] = []

    def embed(self, texts: list[str], on_batch=None) -> list[list[float]]:
        self.calls += 1
        self.texts.extend(texts)
        out = []
        for t in texts:
            seed = hashlib.sha256(t.encode()).digest()
            out.append([seed[i % 32] / 255.0 for i in range(self.dims)])
        self.tokens += sum(len(t.split()) for t in texts)
        return out


class FakeCaptioner:
    def __init__(self, fail_ordinals: set[int] | None = None) -> None:
        self.calls = 0
        self.fail = fail_ordinals or set()

    def describe(self, webp: bytes, label, paper_caption, usage) -> str | None:
        self.calls += 1
        usage.input_tokens += 100
        usage.output_tokens += 20
        if label and any(label.endswith(f" {n}") for n in self.fail):
            return None
        return f"A described figure ({label or 'unlabelled'})."

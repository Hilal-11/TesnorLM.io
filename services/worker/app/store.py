"""Everything the pipeline reads and writes, behind one interface.

`SupabaseStore` talks to Postgres (PostgREST + RPC) and Storage with the service role.
Tests use an in-memory store with the same methods (tests/fakes.py), so the pipeline's rules
(current-run guard, idempotent steps, stage order) are tested without a network.
"""

from __future__ import annotations

from typing import Any, Protocol

DOCUMENT_FIELDS = (
    "id, user_id, notebook_id, title, storage_path, ingest_run_id, deleted_at, stage, "
    "page_count, sha256, file_size, ocr_used"
)


class Store(Protocol):
    def get_document(self, document_id: str) -> dict[str, Any] | None: ...

    def update_document(self, document_id: str, run_id: str, fields: dict[str, Any]) -> bool: ...

    def set_stage(
        self,
        document_id: str,
        run_id: str,
        stage: str,
        progress: int | None = None,
        detail: str | None = None,
        error_code: str | None = None,
        error_vars: dict[str, Any] | None = None,
    ) -> bool: ...

    def finalize(
        self, document_id: str, run_id: str, markdown: str | None, token_count: int | None
    ) -> bool: ...

    def object_size(self, bucket: str, path: str) -> int | None: ...

    def download(self, bucket: str, path: str) -> bytes: ...

    def upload(self, bucket: str, path: str, data: bytes, content_type: str) -> None: ...

    def upsert_figures(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]: ...

    def figures_for_run(self, document_id: str, run_id: str) -> list[dict[str, Any]]: ...

    def update_figure(self, figure_id: str, fields: dict[str, Any]) -> None: ...

    def cached_description(self, user_id: str, image_sha256: str) -> str | None: ...

    def upsert_chunks(self, rows: list[dict[str, Any]]) -> None: ...

    def embedded_chunk_indexes(self, document_id: str, run_id: str) -> set[int]: ...


class SupabaseStore:
    def __init__(self, url: str, service_role_key: str) -> None:
        from supabase import create_client

        self._db = create_client(url, service_role_key)

    # ───────────── documents ─────────────

    def get_document(self, document_id: str) -> dict[str, Any] | None:
        res = (
            self._db.table("documents")
            .select(DOCUMENT_FIELDS)
            .eq("id", document_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def update_document(self, document_id: str, run_id: str, fields: dict[str, Any]) -> bool:
        """Writes only while `run_id` is still the document's current run."""
        res = (
            self._db.table("documents")
            .update(fields)
            .eq("id", document_id)
            .eq("ingest_run_id", run_id)
            .is_("deleted_at", "null")
            .execute()
        )
        return bool(res.data)

    def set_stage(
        self,
        document_id: str,
        run_id: str,
        stage: str,
        progress: int | None = None,
        detail: str | None = None,
        error_code: str | None = None,
        error_vars: dict[str, Any] | None = None,
    ) -> bool:
        res = self._db.rpc(
            "set_document_stage",
            {
                "p_document_id": document_id,
                "p_run_id": run_id,
                "p_stage": stage,
                "p_progress": progress,
                "p_detail": detail,
                "p_error_code": error_code,
                "p_error_vars": error_vars,
            },
        ).execute()
        return bool(res.data)

    def finalize(
        self, document_id: str, run_id: str, markdown: str | None, token_count: int | None
    ) -> bool:
        res = self._db.rpc(
            "finalize_ingest",
            {
                "p_document_id": document_id,
                "p_run_id": run_id,
                "p_markdown": markdown,
                "p_token_count": token_count,
            },
        ).execute()
        return bool(res.data)

    # ───────────── storage ─────────────

    def object_size(self, bucket: str, path: str) -> int | None:
        folder, _, name = path.rpartition("/")
        items = self._db.storage.from_(bucket).list(folder, {"search": name, "limit": 100})
        for item in items or []:
            if item.get("name") == name and item.get("id") is not None:
                size = (item.get("metadata") or {}).get("size")
                return int(size) if size is not None else None
        return None

    def download(self, bucket: str, path: str) -> bytes:
        return self._db.storage.from_(bucket).download(path)

    def upload(self, bucket: str, path: str, data: bytes, content_type: str) -> None:
        self._db.storage.from_(bucket).upload(
            path, data, {"content-type": content_type, "upsert": "true"}
        )

    # ───────────── figures ─────────────

    def upsert_figures(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not rows:
            return []
        res = (
            self._db.table("figures")
            .upsert(rows, on_conflict="document_id,ingest_run_id,ordinal")
            .execute()
        )
        return list(res.data or [])

    def figures_for_run(self, document_id: str, run_id: str) -> list[dict[str, Any]]:
        res = (
            self._db.table("figures")
            .select("*")
            .eq("document_id", document_id)
            .eq("ingest_run_id", run_id)
            .order("ordinal")
            .execute()
        )
        return list(res.data or [])

    def update_figure(self, figure_id: str, fields: dict[str, Any]) -> None:
        self._db.table("figures").update(fields).eq("id", figure_id).execute()

    def cached_description(self, user_id: str, image_sha256: str) -> str | None:
        """A caption already written for the same image bytes, for the same person only."""
        res = (
            self._db.table("figures")
            .select("description")
            .eq("user_id", user_id)
            .eq("image_sha256", image_sha256)
            .not_.is_("description", "null")
            .limit(1)
            .execute()
        )
        return res.data[0]["description"] if res.data else None

    # ───────────── chunks ─────────────

    def upsert_chunks(self, rows: list[dict[str, Any]]) -> None:
        for i in range(0, len(rows), 100):
            (
                self._db.table("chunks")
                .upsert(rows[i : i + 100], on_conflict="document_id,ingest_run_id,chunk_index")
                .execute()
            )

    def embedded_chunk_indexes(self, document_id: str, run_id: str) -> set[int]:
        found: set[int] = set()
        start = 0
        while True:
            res = (
                self._db.table("chunks")
                .select("chunk_index")
                .eq("document_id", document_id)
                .eq("ingest_run_id", run_id)
                .not_.is_("embedding", "null")
                .order("chunk_index")
                .range(start, start + 999)
                .execute()
            )
            rows = res.data or []
            found.update(int(r["chunk_index"]) for r in rows)
            if len(rows) < 1000:
                return found
            start += 1000

"""The real SupabaseStore against the local stack (or a separate TEST project): set_document_stage,
finalize_ingest, storage and upserts, then a full ingest of paper_basic into Postgres.

Run from apps/web so the local stack's keys are injected (never printed):
    node scripts/with-local-supabase.mjs --test ../../services/worker/.venv/Scripts/python.exe \
        -m pytest -q ../../services/worker/tests/test_supabase_store.py
"""

from __future__ import annotations

import os
import uuid

import pytest

URL = os.getenv("TEST_SUPABASE_URL")
KEY = os.getenv("TEST_SUPABASE_SERVICE_ROLE_KEY")

pytestmark = [
    pytest.mark.stack,
    pytest.mark.skipif(not URL or not KEY, reason="needs TEST_SUPABASE_URL (local stack or test project)"),
]

if URL and URL == os.getenv("NEXT_PUBLIC_SUPABASE_URL"):
    raise RuntimeError("Refusing to run: TEST_SUPABASE_URL is the main project.")


@pytest.fixture(scope="module")
def db():
    from supabase import create_client

    return create_client(URL, KEY)


@pytest.fixture(scope="module")
def store():
    from app.store import SupabaseStore

    return SupabaseStore(URL, KEY)


@pytest.fixture()
def document(db, pdf_bytes):
    """A person, a notebook and a document in `uploading`, with the source uploaded."""
    email = f"worker-{uuid.uuid4()}@example.com"
    user = db.auth.admin.create_user({"email": email, "password": f"Pw-{uuid.uuid4()}", "email_confirm": True}).user
    notebook = db.table("notebooks").insert({"user_id": user.id, "title": "Worker test"}).execute().data[0]
    doc = (
        db.table("documents")
        .insert(
            {
                "notebook_id": notebook["id"],
                "user_id": user.id,
                "title": "A Tiny Study of Attention",
                "original_filename": "paper_basic.pdf",
                "mime_type": "application/pdf",
                "file_size": len(pdf_bytes["paper_basic"]),
            }
        )
        .execute()
        .data[0]
    )
    db.storage.from_("documents").upload(
        doc["storage_path"], pdf_bytes["paper_basic"], {"content-type": "application/pdf"}
    )
    yield doc
    db.auth.admin.delete_user(user.id)


def test_stage_rpc_follows_the_contract(store, document):
    doc, run = document["id"], document["ingest_run_id"]
    assert store.set_stage(doc, run, "queued")
    assert not store.set_stage(doc, run, "indexing")  # not allowed from queued
    assert not store.set_stage(doc, str(uuid.uuid4()), "validating")  # stale run
    assert store.set_stage(doc, run, "validating", 3, "Checking the file")
    assert store.set_stage(doc, run, "validating", 1)  # progress update: kept at 3
    assert store.get_document(doc)["stage"] == "validating"
    assert not store.set_stage(doc, run, "ready")  # only finalize_ingest makes it ready
    assert store.update_document(doc, run, {"page_count": 3})
    assert not store.update_document(doc, str(uuid.uuid4()), {"page_count": 9})


def test_storage_helpers(store, document):
    assert store.object_size("documents", document["storage_path"]) == document["file_size"]
    assert store.object_size("documents", f"{document['user_id']}/{document['id']}/missing.pdf") is None
    path = f"{document['user_id']}/{document['id']}/{document['ingest_run_id']}/doc.json"
    store.upload("ingest-artifacts", path, b'{"a":1}', "application/json")
    store.upload("ingest-artifacts", path, b'{"a":2}', "application/json")  # upsert
    assert store.download("ingest-artifacts", path) == b'{"a":2}'


@pytest.mark.docling
def test_full_ingest_into_postgres(db, store, document):
    from app.pipeline import Deps, Run, run_all
    from app.settings import get_settings
    from fakes import FakeCaptioner, FakeEmbedder

    doc_id, run_id = document["id"], document["ingest_run_id"]
    assert store.set_stage(doc_id, run_id, "queued")
    deps = Deps(store=store, settings=get_settings(), embedder=FakeEmbedder(), captioner=FakeCaptioner())
    assert run_all(deps, Run(doc_id, run_id), lambda name, fn: fn()) == {"ready": True}

    row = db.table("documents").select("*").eq("id", doc_id).single().execute().data
    assert (row["stage"], row["progress"], row["ready_run_id"]) == ("ready", 100, run_id)
    assert row["page_count"] == 3 and row["figure_count"] == 2 and row["chunk_count"] > 0
    assert set(row["stage_timings"]) >= {"uploading", "queued", "validating", "parsing", "reading_figures", "indexing", "ready"}
    assert all("duration_ms" in v for k, v in row["stage_timings"].items() if k != "ready")

    chunks = db.table("chunks").select("kind, page_start, page_end, bboxes, headings, figure_id").eq("document_id", doc_id).execute().data
    assert len(chunks) == row["chunk_count"]
    assert all(1 <= c["page_start"] <= c["page_end"] <= 3 and c["bboxes"] for c in chunks)
    assert sum(c["kind"] == "figure_caption" for c in chunks) == 2
    assert any(c["kind"] == "table" for c in chunks)

    # Search returns only the published run, with page fields.
    hits = db.rpc(
        "hybrid_search",
        {"query_text": "attention layers", "query_embedding": [0.01] * 1536, "p_notebook_id": row["notebook_id"]},
    ).execute().data
    assert hits and all(h["page_start"] >= 1 and h["kind"] in ("text", "table", "figure_caption") for h in hits)

    figures = db.table("figures").select("image_path").eq("document_id", doc_id).execute().data
    for f in figures:
        assert store.object_size("documents", f["image_path"]) is not None

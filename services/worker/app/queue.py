"""The `ingest-document` queue function (spec section 9), served at /api/inngest.

- Trigger: `document/uploaded` (sent by the web API after an upload or a re-process).
- Concurrency: 2 runs at a time for this deployment, and 2 per person.
- Retries: 3 per step with Inngest's backoff; a retry resumes at the step that failed, because
  every finished step's result is memoized by the queue.
- Cancelled by `document/reprocess` for the same document with a different run id, by
  `document/deleted` for the same document, and by `notebook/deleted` for its notebook. The
  current-run guard in every step makes a run that slips past cancellation harmless.
- After the last retry, `on_failure` marks the document failed with `internal`.
- In production (INNGEST_DEV unset) every request must carry a valid Inngest signature.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import inngest

from app.captions import Captioner
from app.contract import EVENTS
from app.embed import Embedder
from app.pipeline import Deps, Run, fail_internal, run_all
from app.settings import get_settings
from app.store import SupabaseStore

FUNCTION_ID = "ingest-document"
CONCURRENCY = 2
CONCURRENCY_PER_USER = 2
RETRIES = 3


def make_client() -> inngest.Inngest:
    settings = get_settings()
    return inngest.Inngest(
        app_id="tensorlm-worker",
        is_production=not settings.inngest_dev,
        signing_key=settings.inngest_signing_key,
        event_key=settings.inngest_event_key,
    )


@lru_cache(maxsize=1)
def deps() -> Deps:
    settings = get_settings()
    store = SupabaseStore(settings.supabase_url, settings.supabase_service_role_key)
    if settings.worker_fake_ai:
        from app.fake_ai import FakeEmbedder

        return Deps(store=store, settings=settings, embedder=FakeEmbedder(), captioner=None)  # type: ignore[arg-type]
    captioner = (
        Captioner(settings.anthropic_api_key, settings.fast_model)
        if settings.anthropic_api_key
        else None
    )
    embedder = Embedder(settings.openai_api_key, settings.embedding_model, settings.embedding_dims)
    return Deps(store=store, settings=settings, embedder=embedder, captioner=captioner)


def run_of(data: dict[str, Any]) -> Run:
    return Run(document_id=str(data["document_id"]), run_id=str(data["run_id"]))


def cancel_rules() -> list[inngest.Cancel]:
    return [
        inngest.Cancel(
            event=EVENTS.reprocess,
            if_exp="async.data.document_id == event.data.document_id"
            " && async.data.run_id != event.data.run_id",
        ),
        inngest.Cancel(
            event=EVENTS.deleted, if_exp="async.data.document_id == event.data.document_id"
        ),
        inngest.Cancel(
            event=EVENTS.notebook_deleted,
            if_exp="async.data.notebook_id == event.data.notebook_id",
        ),
    ]


def concurrency_rules() -> list[inngest.Concurrency]:
    return [
        inngest.Concurrency(limit=CONCURRENCY),
        inngest.Concurrency(limit=CONCURRENCY_PER_USER, key="event.data.user_id"),
    ]


def on_failure(ctx: inngest.ContextSync) -> None:
    original = (ctx.event.data or {}).get("event") or {}
    data = original.get("data") or {}
    if "document_id" in data and "run_id" in data:
        error = (ctx.event.data or {}).get("error") or {}
        fail_internal(deps().store, run_of(data), str(error.get("name") or "error"))


def handler(ctx: inngest.ContextSync) -> dict[str, Any]:
    run = run_of(ctx.event.data or {})
    return run_all(deps(), run, lambda name, fn: ctx.step.run(name, fn))


def build_function(client: inngest.Inngest) -> inngest.Function[Any]:
    return client.create_function(
        fn_id=FUNCTION_ID,
        name="Ingest document",
        trigger=inngest.TriggerEvent(event=EVENTS.uploaded),
        concurrency=concurrency_rules(),
        retries=RETRIES,
        cancel=cancel_rules(),
        # One run per ingest run id, even if the confirm is clicked twice.
        idempotency="event.data.run_id",
        on_failure=on_failure,
    )(handler)

"""TensorLM ingestion worker.

  GET  /health       the process is up
  GET  /ready        models loaded and storage reachable (503 until then)
  *    /api/inngest  the queue calls the `ingest-document` function here (signed in production)

There is no other way in: the old `POST /ingest` + shared-secret route is gone.
Run locally: see README "Run locally" (Inngest Dev Server, this worker, the web app).
"""

from __future__ import annotations

import os
import threading
from typing import Any

import inngest
import inngest.fast_api
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app import parse
from app.contract import STORAGE
from app.log import get_log, setup_logging
from app.queue import build_function, deps, make_client
from app.settings import get_settings

settings = get_settings()
setup_logging(settings.log_level)
log = get_log("worker")

app = FastAPI(title="TensorLM worker", docs_url=None, redoc_url=None, openapi_url=None)
client = make_client()
inngest.fast_api.serve(
    app,
    client,
    [build_function(client)],
    # Unsigned sync requests are only accepted by the local Dev Server.
    enable_unauthed_sync=settings.inngest_dev,
    # Long steps (parsing takes minutes): keep proxies from closing the connection.
    streaming=inngest.Streaming.FORCE if not settings.inngest_dev else inngest.Streaming.DISABLE,
)

_warm = {"done": False, "error": None}


def _warm_up() -> None:
    try:
        parse.warm_up()
        _warm["done"] = True
        log.info("models loaded")
    except Exception as exc:  # noqa: BLE001
        _warm["error"] = type(exc).__name__
        log.error("model warm-up failed", exc=True)


if os.getenv("WORKER_WARM_UP", "1") != "0":
    threading.Thread(target=_warm_up, name="warm-up", daemon=True).start()


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True}


@app.get("/ready")
def ready() -> JSONResponse:
    checks: dict[str, Any] = {"models": _warm["done"] or parse.models_loaded()}
    try:
        deps().store.object_size(STORAGE.bucket, "readiness-probe/none")
        checks["storage"] = True
    except Exception as exc:  # noqa: BLE001
        checks["storage"] = False
        log.warning("storage not reachable", exception=type(exc).__name__)
    ok = all(checks.values())
    return JSONResponse({"ok": ok, **checks}, status_code=200 if ok else 503)

"""The queue function's configuration and the HTTP surface (health, ready, signatures)."""

from __future__ import annotations

import importlib

import inngest
import inngest.fast_api
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import queue
from app.contract import EVENTS
from app.pipeline import Run


def config():
    client = inngest.Inngest(app_id="test", is_production=False)
    fn = queue.build_function(client)
    return fn.get_config("http://localhost/api/inngest").main.model_dump(by_alias=True, exclude_none=True)


def test_ingest_function_is_triggered_by_uploaded():
    c = config()
    assert c["id"].endswith("ingest-document")
    assert c["triggers"] == [{"event": "document/uploaded"}] or c["triggers"][0]["event"] == EVENTS.uploaded


def test_concurrency_is_two_per_deployment_and_two_per_person():
    limits = config()["concurrency"]
    assert {"limit": 2} in [{k: v for k, v in rule.items() if k in ("limit", "key")} for rule in limits]
    assert any(rule.get("key") == "event.data.user_id" and rule["limit"] == 2 for rule in limits)


def test_retries_and_idempotency():
    c = config()
    steps = c["steps"]
    step = steps[next(iter(steps))] if isinstance(steps, dict) else steps[0]
    assert step["retries"]["attempts"] == 3
    assert c["idempotency"] == "event.data.run_id"


def test_cancel_rules_match_document_and_run():
    rules = {r["event"]: r["if"] for r in config()["cancel"]}
    assert rules[EVENTS.reprocess] == (
        "async.data.document_id == event.data.document_id && async.data.run_id != event.data.run_id"
    )
    assert rules[EVENTS.deleted] == "async.data.document_id == event.data.document_id"
    assert rules[EVENTS.notebook_deleted] == "async.data.notebook_id == event.data.notebook_id"


def test_final_failure_marks_the_document_internal(monkeypatch):
    calls = []
    monkeypatch.setattr(queue, "fail_internal", lambda store, run, reason: calls.append((run, reason)))
    monkeypatch.setattr(queue, "deps", lambda: type("D", (), {"store": None})())
    event = inngest.Event(
        name="inngest/function.failed",
        data={"event": {"data": {"document_id": "d1", "run_id": "r1"}}, "error": {"name": "MemoryError"}},
    )
    queue.on_failure(type("Ctx", (), {"event": event})())
    assert calls == [(Run("d1", "r1"), "MemoryError")]


def test_unsigned_requests_are_rejected_in_production():
    app = FastAPI()
    client = inngest.Inngest(app_id="test", is_production=True, signing_key="signkey-prod-" + "ab" * 32)
    inngest.fast_api.serve(app, client, [queue.build_function(client)], enable_unauthed_sync=False)
    http = TestClient(app)
    res = http.post("/api/inngest?fnId=test-ingest-document&stepId=step", json={"event": {}, "events": [], "steps": {}, "ctx": {}})
    assert res.status_code in (401, 403, 500)
    assert res.status_code != 200
    assert http.put("/api/inngest").status_code != 200  # unsigned sync refused too


@pytest.fixture()
def main_app(monkeypatch):
    import app.main as main

    main = importlib.reload(main)
    return main


def test_health(main_app):
    assert TestClient(main_app.app).get("/health").json() == {"ok": True}


def test_ready_reports_models_and_storage(main_app, monkeypatch):
    class Store:
        def object_size(self, bucket, path):
            return None

    monkeypatch.setattr(main_app, "deps", lambda: type("D", (), {"store": Store()})())
    monkeypatch.setattr(main_app.parse, "models_loaded", lambda: False)
    main_app._warm["done"] = False
    http = TestClient(main_app.app)
    res = http.get("/ready")
    assert res.status_code == 503 and res.json()["models"] is False and res.json()["storage"] is True
    main_app._warm["done"] = True
    assert http.get("/ready").status_code == 200

    class Down:
        def object_size(self, bucket, path):
            raise ConnectionError()

    monkeypatch.setattr(main_app, "deps", lambda: type("D", (), {"store": Down()})())
    assert http.get("/ready").json() == {"ok": False, "models": True, "storage": False}


def test_old_ingest_route_is_gone(main_app):
    assert TestClient(main_app.app).post("/ingest", json={"document_id": "x"}).status_code in (404, 405)

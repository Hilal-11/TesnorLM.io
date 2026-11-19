"""The shared ingestion contract: validity, helpers, and parity with the web app."""

from __future__ import annotations

import copy
import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from app import contract
from app.contract import (
    CONTRACT,
    STAGES,
    Contract,
    ContractError,
    can_transition,
    contract_path,
    detail_line,
    error_copy,
    is_stage,
    is_terminal,
    parse_contract,
    storage_path,
    ui_word,
)

SOURCE = contract_path()
FIXTURE = SOURCE.parent / "fixtures" / "ingestion-cases.json"
RAW: dict[str, Any] = json.loads(SOURCE.read_text(encoding="utf-8"))


# ───────────── The contract itself ─────────────


def test_loads_the_repo_contract() -> None:
    assert SOURCE.parts[-2:] == ("contracts", "ingestion.json")
    assert CONTRACT.version == 1
    assert Contract.model_validate(RAW).problems() == []


def test_every_stage_has_a_learner_word() -> None:
    assert {ui_word(s) for s in STAGES} == {
        "Uploading",
        "Queued",
        "Reading",
        "Indexing",
        "Ready",
        "Failed",
    }


def test_every_transition_target_is_a_stage() -> None:
    for source in STAGES:
        for target in CONTRACT.transitions[source]:
            assert is_stage(target)
        if not is_terminal(source):
            assert can_transition(source, "failed")


def test_every_error_has_message_and_fix() -> None:
    for code in CONTRACT.errors:
        copy_ = error_copy(code)
        assert copy_.code == code
        assert copy_.message and copy_.fix


def _mutated(mutate: Callable[[dict[str, Any]], object]) -> str:
    data = copy.deepcopy(RAW)
    mutate(data)
    return json.dumps(data)


@pytest.mark.parametrize(
    ("mutate", "problem"),
    [
        (lambda c: c["uiWords"].pop("ocr"), 'uiWords: missing "ocr"'),
        (
            lambda c: c["transitions"]["parsing"].append("summarising"),
            'transitions.parsing: unknown stage "summarising"',
        ),
        (lambda c: c["errors"]["not_pdf"].pop("fix"), "fix"),
        (
            lambda c: c["errors"]["corrupt_pdf"].update(message="Page {page} is damaged."),
            'errors.corrupt_pdf placeholders: unknown "page"',
        ),
        (
            lambda c: c["errors"]["file_too_large"].pop("fallback"),
            "errors.file_too_large: vars need a fallback",
        ),
        (
            lambda c: c["errors"]["internal"].update(actions=["call_support"]),
            'errors.internal: unknown action "call_support"',
        ),
        (lambda c: c["errors"].pop("internal"), 'errors: missing "internal"'),
        (lambda c: c["transitions"].update(ready=["queued"]), "transitions.ready: must be terminal"),
        (
            lambda c: c["transitions"].update(indexing=["ready"]),
            "transitions.indexing: must be able to fail",
        ),
        (
            lambda c: c["storage"]["paths"].update(source="{documentId}/source.pdf"),
            "storage.paths.source: must start with {userId}/",
        ),
        (
            lambda c: c["details"]["queued"].update(template="Waiting {"),
            "details.queued: unmatched",
        ),
        (lambda c: c.update(extra=1), "extra"),
        (lambda c: c["limits"].update(maxPages="200"), "maxPages"),
    ],
)
def test_rejects_a_broken_contract(mutate: Callable[[dict[str, Any]], object], problem: str) -> None:
    with pytest.raises(ContractError) as caught:
        parse_contract(_mutated(mutate))
    assert problem in str(caught.value)


def test_finds_the_contract_from_an_env_override(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    custom = tmp_path / "ingestion.json"
    custom.write_text(SOURCE.read_text(encoding="utf-8"), encoding="utf-8")
    monkeypatch.setenv("INGESTION_CONTRACT_PATH", str(custom))
    assert contract.contract_path() == custom


# ───────────── Helpers (Python-only edge cases) ─────────────


def test_integral_floats_render_like_integers() -> None:
    # JSON (and JavaScript) can't tell 4.0 from 4, so neither do we.
    assert detail_line("parsing", {"page": 4.0, "pages": 12}) == "Reading page 4 of 12"
    assert detail_line("parsing", {"page": 4.5, "pages": 12}) == "Reading the pages"


def test_booleans_are_not_numbers() -> None:
    assert detail_line("ready", {"pages": True}) == "Ready"


def test_error_copy_and_storage_paths() -> None:
    copy_ = error_copy("file_too_large", {"sizeMb": "120", "limitMb": 50})
    assert f"{copy_.message} {copy_.fix}" == (
        "This file is 120 MB. The limit is 50 MB. Split the PDF or upload chapters separately."
    )
    assert error_copy("made_up").code == "internal"
    assert [c for c in CONTRACT.errors if error_copy(c).auto_retry] == ["internal"]
    ids = {"userId": "u-1", "documentId": "d-1", "runId": "r-1", "n": 3}
    assert storage_path("figure", ids) == "u-1/d-1/figures/r-1/3.webp"
    with pytest.raises(ValueError, match="documentId"):
        storage_path("source", {**ids, "documentId": "../d-2"})


# ───────────── Parity with the web app ─────────────

CASES: dict[str, Any] = json.loads(FIXTURE.read_text(encoding="utf-8"))


def _run(fn: Callable[[], Any]) -> dict[str, Any]:
    try:
        return {"out": fn()}
    except (ValueError, KeyError):
        return {"throws": True}


def _expected(case: dict[str, Any]) -> dict[str, Any]:
    return {"throws": True} if case.get("throws") else {"out": case["out"]}


def test_fixture_matches_this_contract_version() -> None:
    assert CASES["version"] == CONTRACT.version


@pytest.mark.parametrize("case", CASES["uiWord"], ids=lambda c: c["stage"])
def test_parity_ui_word(case: dict[str, Any]) -> None:
    assert _run(lambda: ui_word(case["stage"])) == _expected(case)


@pytest.mark.parametrize("case", CASES["canTransition"], ids=lambda c: f"{c['from']}->{c['to']}")
def test_parity_can_transition(case: dict[str, Any]) -> None:
    assert can_transition(case["from"], case["to"]) is case["out"]


@pytest.mark.parametrize("case", CASES["isTerminal"], ids=lambda c: c["stage"])
def test_parity_is_terminal(case: dict[str, Any]) -> None:
    assert _run(lambda: is_terminal(case["stage"])) == _expected(case)


@pytest.mark.parametrize("case", CASES["detailLine"])
def test_parity_detail_line(case: dict[str, Any]) -> None:
    assert _run(lambda: detail_line(case["stage"], case["vars"])) == _expected(case)


@pytest.mark.parametrize("case", CASES["errorCopy"])
def test_parity_error_copy(case: dict[str, Any]) -> None:
    assert error_copy(case["code"], case["vars"]).to_json() == case["out"]


@pytest.mark.parametrize("case", CASES["storagePath"])
def test_parity_storage_path(case: dict[str, Any]) -> None:
    assert _run(lambda: storage_path(case["kind"], case["vars"])) == _expected(case)

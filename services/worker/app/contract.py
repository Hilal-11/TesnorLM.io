"""The ingestion contract shared with the web app.

Source types, stage names, allowed transitions, learner words, detail lines, error and notice
copy, events, limits and storage paths. Source of truth: contracts/ingestion.json at the repo root (spec:
docs/specs/ingestion.md). apps/web/src/lib/ingestion/contract.ts loads the same file, and
contracts/fixtures/ingestion-cases.json proves both give identical answers
(tests/test_contract.py). Never hard-code a stage name, source type, error code or their
copy elsewhere.

The file is found by INGESTION_CONTRACT_PATH, else by walking up from this file to a
`contracts/ingestion.json` (the repo in development; the worker image copies it to
/app/contracts/ingestion.json).
"""

from __future__ import annotations

import os
import re
from collections.abc import Mapping
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

# `{name}` inserts a value; `{name:one|other}` picks a word by count ("1 page", "2 pages").
PLACEHOLDER = re.compile(r"\{([A-Za-z][A-Za-z0-9]*)(?::([^{}|]*)\|([^{}]*))?\}")
MAX_SAFE_INTEGER = 2**53 - 1  # same range as JavaScript's Number.isSafeInteger
STORAGE_VARS = frozenset({"userId", "documentId", "runId", "n"})
SAFE_SEGMENT = re.compile(r"[A-Za-z0-9_-]+")
NAME = re.compile(r"[a-z][a-z_]*")
EVENT_NAME = re.compile(r"[a-z]+/[a-z-]+")
EXTENSION = re.compile(r"\.[a-z0-9]+")
MIME = re.compile(r"[a-z]+/[a-z0-9.+-]+")


# ───────────── Templates ─────────────


def _placeholder_names(template: str) -> list[str]:
    return [m.group(1) for m in PLACEHOLDER.finditer(template)]


def _has_stray_braces(template: str) -> bool:
    return bool(re.search(r"[{}]", PLACEHOLDER.sub("", template)))


def _render_value(value: Any) -> str | None:
    """Strings, or whole numbers in the safe-integer range. Anything else counts as missing."""
    if isinstance(value, bool):
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, int):
        return str(value) if abs(value) <= MAX_SAFE_INTEGER else None
    if isinstance(value, float) and value.is_integer() and abs(value) <= MAX_SAFE_INTEGER:
        return str(int(value))  # JSON can't tell 4.0 from 4, and neither can JavaScript
    return None


def _fill(template: str, values: Mapping[str, Any]) -> str | None:
    """Fills every placeholder, or returns None when any value is missing or unusable."""
    missing = False

    def replace(m: re.Match[str]) -> str:
        nonlocal missing
        name, one, other = m.group(1), m.group(2), m.group(3)
        value = _render_value(values[name]) if name in values else None
        if value is None:
            missing = True
            return ""
        if one is None:
            return value
        return one if value == "1" else (other or "")

    out = PLACEHOLDER.sub(replace, template)
    return None if missing else out


# ───────────── Model and validation ─────────────


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True, populate_by_name=True)


class TemplateDef(_Model):
    template: str = Field(min_length=1)
    fallback: str | None = Field(default=None, min_length=1)
    vars: list[str] = Field(default_factory=list)


class ErrorDef(_Model):
    message: str = Field(min_length=1)
    fallback: str | None = Field(default=None, min_length=1)
    fix: str = Field(min_length=1)
    vars: list[str] = Field(default_factory=list)
    actions: list[str] = Field(default_factory=list)
    auto_retry: bool = Field(alias="autoRetry")


class NoticeDef(_Model):
    message: str = Field(min_length=1)
    fallback: str | None = Field(default=None, min_length=1)
    fix: str | None = Field(default=None, min_length=1)
    vars: list[str] = Field(default_factory=list)


class SourceTypeDef(_Model):
    label: str = Field(min_length=1)
    origin: Literal["file", "link", "drive", "text"]
    unit: Literal["page", "slide", "sheet", "time"] | None
    extensions: list[str]
    mime_types: list[str] = Field(alias="mimeTypes")


class Askable(_Model):
    word: str = Field(min_length=1)
    details: dict[str, TemplateDef]


class Events(_Model):
    uploaded: str
    reprocess: str
    deleted: str
    notebook_deleted: str = Field(alias="notebookDeleted")
    fast_ready: str = Field(alias="fastReady")
    password_provided: str = Field(alias="passwordProvided")
    sources_changed: str = Field(alias="sourcesChanged")


class Limits(_Model):
    max_upload_mb: int = Field(alias="maxUploadMb", gt=0)
    max_pages: int = Field(alias="maxPages", gt=0)
    fast_pass_page_batch: int = Field(alias="fastPassPageBatch", gt=0)
    max_files_per_batch: int = Field(alias="maxFilesPerBatch", gt=0)
    max_parallel_uploads: int = Field(alias="maxParallelUploads", gt=0)
    max_sources_free: int = Field(alias="maxSourcesFree", gt=0)
    password_attempts: int = Field(alias="passwordAttempts", gt=0)
    password_lock_minutes: int = Field(alias="passwordLockMinutes", gt=0)
    password_ttl_seconds: int = Field(alias="passwordTtlSeconds", gt=0)
    web_max_mb: int = Field(alias="webMaxMb", gt=0)
    web_timeout_seconds: int = Field(alias="webTimeoutSeconds", gt=0)
    web_max_redirects: int = Field(alias="webMaxRedirects", gt=0)
    suggested_questions: int = Field(alias="suggestedQuestions", gt=0)
    insights_debounce_seconds: int = Field(alias="insightsDebounceSeconds", gt=0)


class StoragePaths(_Model):
    source: str
    figure: str
    parsed: str


class Storage(_Model):
    bucket: str = Field(min_length=1)
    artifacts_bucket: str = Field(alias="artifactsBucket", min_length=1)
    paths: StoragePaths


def _same_keys(where: str, actual: list[str], expected: list[str]) -> list[str]:
    a, e = set(actual), set(expected)
    return [f'{where}: missing "{k}"' for k in expected if k not in a] + [
        f'{where}: unknown "{k}"' for k in actual if k not in e
    ]


def _template_problems(
    where: str, template: str, names: list[str], fallback: str | None
) -> list[str]:
    problems: list[str] = []
    if _has_stray_braces(template):
        problems.append(f"{where}: unmatched {{ or }}")
    if len(set(names)) != len(names):
        problems.append(f"{where}: repeated vars")
    problems += _same_keys(f"{where} placeholders", _placeholder_names(template), names)
    if names and fallback is None:
        problems.append(f"{where}: vars need a fallback")
    if not names and fallback is not None:
        problems.append(f"{where}: fallback without vars")
    if fallback is not None and re.search(r"[{}]", fallback):
        problems.append(f"{where}: fallback can't use placeholders")
    return problems


class Contract(_Model):
    version: Literal[2]
    source_types: dict[str, SourceTypeDef] = Field(alias="sourceTypes")
    stages: list[str] = Field(min_length=2)
    transitions: dict[str, list[str]]
    ui_words: dict[str, str] = Field(alias="uiWords")
    details: dict[str, TemplateDef]
    askable: Askable
    actions: dict[str, str]
    errors: dict[str, ErrorDef]
    notices: dict[str, NoticeDef]
    events: Events
    limits: Limits
    storage: Storage

    @model_validator(mode="after")
    def check_cross_references(self) -> Contract:
        problems = self.problems()
        if problems:
            raise ValueError("; ".join(problems))
        return self

    def problems(self) -> list[str]:
        """Every cross-reference problem. Same rules as validateContract() in contract.ts."""
        stages = set(self.stages)
        problems: list[str] = []

        owners: dict[str, str] = {}
        for type_, t in self.source_types.items():
            where = f"sourceTypes.{type_}"
            if not NAME.fullmatch(type_):
                problems.append(f'sourceTypes: bad name "{type_}"')
            if t.origin == "file" and not t.extensions:
                problems.append(f"{where}: a file type needs extensions")
            if t.origin != "file" and (t.extensions or t.mime_types):
                problems.append(f"{where}: only file types have extensions or MIME types")
            for ext in t.extensions:
                if not EXTENSION.fullmatch(ext):
                    problems.append(f'{where}: bad extension "{ext}"')
                if ext in owners:
                    problems.append(f'{where}: "{ext}" is already {owners[ext]}')
                owners[ext] = type_
            for mime in t.mime_types:
                if not MIME.fullmatch(mime):
                    problems.append(f'{where}: bad MIME type "{mime}"')

        for stage in self.stages:
            if not NAME.fullmatch(stage):
                problems.append(f'stages: bad name "{stage}"')
        if len(stages) != len(self.stages):
            problems.append("stages: repeated stage")
        for required in ("ready", "failed"):
            if required not in stages:
                problems.append(f'stages: missing "{required}"')

        problems += _same_keys("transitions", list(self.transitions), self.stages)
        for source, targets in self.transitions.items():
            for target in targets:
                if target not in stages:
                    problems.append(f'transitions.{source}: unknown stage "{target}"')
                if target == source:
                    problems.append(f"transitions.{source}: can't move to itself")
            if len(set(targets)) != len(targets):
                problems.append(f"transitions.{source}: repeated")
            terminal = source in ("ready", "failed")
            if terminal and targets:
                problems.append(f"transitions.{source}: must be terminal")
            if not terminal and "failed" not in targets:
                problems.append(f"transitions.{source}: must be able to fail")

        problems += _same_keys("uiWords", list(self.ui_words), self.stages)
        for stage, word in self.ui_words.items():
            if not word:
                problems.append(f"uiWords.{stage}: empty")

        detailed = [s for s in self.stages if s != "failed"]
        problems += _same_keys("details", list(self.details), detailed)
        for stage, d in self.details.items():
            problems += _template_problems(f"details.{stage}", d.template, d.vars, d.fallback)

        for stage, d in self.askable.details.items():
            where = f"askable.details.{stage}"
            if stage not in stages or stage in ("ready", "failed"):
                problems.append(f"{where}: not a working stage")
            problems += _template_problems(where, d.template, d.vars, d.fallback)

        for action_id, label in self.actions.items():
            if not NAME.fullmatch(action_id) or not label:
                problems.append(f'actions: bad action "{action_id}"')

        if "internal" not in self.errors:
            problems.append('errors: missing "internal"')
        for code, e in self.errors.items():
            if not NAME.fullmatch(code):
                problems.append(f'errors: bad code "{code}"')
            problems += _template_problems(f"errors.{code}", e.message, e.vars, e.fallback)
            if re.search(r"[{}]", e.fix):
                problems.append(f"errors.{code}: fix can't use placeholders")
            for action_id in e.actions:
                if action_id not in self.actions:
                    problems.append(f'errors.{code}: unknown action "{action_id}"')

        for code, n in self.notices.items():
            if not NAME.fullmatch(code):
                problems.append(f'notices: bad code "{code}"')
            problems += _template_problems(f"notices.{code}", n.message, n.vars, n.fallback)
            if n.fix is not None and re.search(r"[{}]", n.fix):
                problems.append(f"notices.{code}: fix can't use placeholders")

        for key, name in self.events.model_dump(by_alias=True).items():
            if not EVENT_NAME.fullmatch(name):
                problems.append(f'events.{key}: bad event name "{name}"')

        for kind, path in self.storage.paths.model_dump().items():
            where = f"storage.paths.{kind}"
            if _has_stray_braces(path) or ":" in path:
                problems.append(f"{where}: bad placeholder")
            for name in _placeholder_names(path):
                if name not in STORAGE_VARS:
                    problems.append(f'{where}: unknown placeholder "{name}"')
            # Storage RLS allows a user only inside their own first folder.
            if not path.startswith("{userId}/"):
                problems.append(f"{where}: must start with {{userId}}/")
        return problems


class ContractError(ValueError):
    """contracts/ingestion.json is missing or invalid."""


def contract_path() -> Path:
    override = os.getenv("INGESTION_CONTRACT_PATH")
    if override:
        return Path(override)
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "contracts" / "ingestion.json"
        if candidate.is_file():
            return candidate
    raise ContractError(
        "contracts/ingestion.json not found: set INGESTION_CONTRACT_PATH or copy it into the image"
    )


def parse_contract(text: str) -> Contract:
    try:
        return Contract.model_validate_json(text)
    except ValidationError as exc:
        raise ContractError(f"contracts/ingestion.json is invalid: {exc}") from exc


@lru_cache(maxsize=1)
def get_contract() -> Contract:
    return parse_contract(contract_path().read_text(encoding="utf-8"))


# ───────────── API ─────────────

CONTRACT = get_contract()
STAGES: tuple[str, ...] = tuple(CONTRACT.stages)
SOURCE_TYPES = CONTRACT.source_types
EVENTS = CONTRACT.events
LIMITS = CONTRACT.limits  # defaults only: settings read MAX_UPLOAD_MB, MAX_PAGES from env
STORAGE = CONTRACT.storage


class _Names:
    """Names the contract defines, as attributes: `STAGE.parsing`, `ERROR.corrupt_pdf`.

    Worker code uses these instead of string literals, so a renamed or removed stage or error
    code fails loudly (tests/test_contract_names.py also checks every use statically)."""

    def __init__(self, kind: str, names: object) -> None:
        self._kind = kind
        self._names = frozenset(names)  # type: ignore[arg-type]

    def __getattr__(self, name: str) -> str:
        if name.startswith("_") or name not in self._names:
            raise AttributeError(f'{self._kind} "{name}" is not in contracts/ingestion.json')
        return name

    def __contains__(self, name: object) -> bool:
        return name in self._names


STAGE = _Names("stage", CONTRACT.stages)
ERROR = _Names("error code", CONTRACT.errors)
NOTICE = _Names("notice code", CONTRACT.notices)
SOURCE_TYPE = _Names("source type", CONTRACT.source_types)
_BY_EXTENSION = {ext: t for t, d in CONTRACT.source_types.items() for ext in d.extensions}


@dataclass(frozen=True)
class ErrorAction:
    id: str
    label: str


@dataclass(frozen=True)
class ErrorCopy:
    code: str
    message: str
    fix: str
    actions: tuple[ErrorAction, ...]
    auto_retry: bool  # whether the queue retries the failed step on its own

    def to_json(self) -> dict[str, Any]:
        """The shape contract.ts returns (camelCase), for the parity fixture."""
        return {
            "code": self.code,
            "message": self.message,
            "fix": self.fix,
            "actions": [{"id": a.id, "label": a.label} for a in self.actions],
            "autoRetry": self.auto_retry,
        }


@dataclass(frozen=True)
class NoticeCopy:
    code: str
    message: str
    fix: str | None

    def to_json(self) -> dict[str, Any]:
        return {"code": self.code, "message": self.message, "fix": self.fix}


def is_stage(value: object) -> bool:
    return isinstance(value, str) and value in CONTRACT.transitions


def _assert_stage(stage: str) -> None:
    if not is_stage(stage):
        raise ValueError(f'Unknown ingestion stage "{stage}"')


def is_source_type(value: object) -> bool:
    return isinstance(value, str) and value in CONTRACT.source_types


def ui_word(stage: str, *, askable: bool = False) -> str:
    """The learner word for a stage ("Reading", "Ready to ask", "Couldn't read").

    With `askable`, a stage that improves an already-askable source says "Ready to ask"."""
    _assert_stage(stage)
    if askable and stage in CONTRACT.askable.details:
        return CONTRACT.askable.word
    return CONTRACT.ui_words[stage]


def can_transition(from_stage: str, to_stage: str) -> bool:
    """Whether a run may move between stages. Staying in a stage is a progress update."""
    return (
        is_stage(from_stage)
        and is_stage(to_stage)
        and to_stage in CONTRACT.transitions[from_stage]
    )


def is_terminal(stage: str) -> bool:
    """Ready and Failed end a run; a re-process starts a new run."""
    _assert_stage(stage)
    return not CONTRACT.transitions[stage]


def detail_line(
    stage: str, values: Mapping[str, Any] | None = None, *, askable: bool = False
) -> str:
    """The status line under a source ("Reading page 18 of 42"). Failed has none: use error_copy.

    With `askable`, stages that improve an askable source use their "Ready to ask · …" line."""
    _assert_stage(stage)
    detail = (CONTRACT.askable.details.get(stage) if askable else None) or CONTRACT.details.get(
        stage
    )
    if detail is None:
        raise ValueError(f'Stage "{stage}" has no detail line; use error_copy()')
    filled = _fill(detail.template, values or {})
    return filled if filled is not None else (detail.fallback or detail.template)


def error_copy(code: str | None, values: Mapping[str, Any] | None = None) -> ErrorCopy:
    """Reason + fix for an error code. Unknown or empty codes get the "internal" copy."""
    known = code if code is not None and code in CONTRACT.errors else "internal"
    d = CONTRACT.errors[known]
    filled = _fill(d.message, values or {})
    return ErrorCopy(
        code=known,
        message=filled if filled is not None else (d.fallback or d.message),
        fix=d.fix,
        actions=tuple(ErrorAction(a, CONTRACT.actions[a]) for a in d.actions),
        auto_retry=d.auto_retry,
    )


def notice_copy(code: str | None, values: Mapping[str, Any] | None = None) -> NoticeCopy | None:
    """A note on a usable source ("TensorLM read the first 2000 of 2400 pages."). Unknown: None."""
    if code is None or code not in CONTRACT.notices:
        return None
    d = CONTRACT.notices[code]
    filled = _fill(d.message, values or {})
    return NoticeCopy(
        code=code, message=filled if filled is not None else (d.fallback or d.message), fix=d.fix
    )


def source_type_from_name(filename: str) -> str | None:
    """The source type a file name's extension suggests (case-insensitive), or None.

    Only a hint: preflight sniffs the bytes and routes by the real type."""
    base = filename[max(filename.rfind("/"), filename.rfind("\\")) + 1 :]
    dot = base.rfind(".")
    if dot < 0:
        return None
    return _BY_EXTENSION.get(base[dot:].lower())


def storage_path(kind: Literal["source", "figure", "parsed"], values: Mapping[str, Any]) -> str:
    """A storage object path. Raises when a value is missing or isn't a plain path segment."""
    template: str = getattr(STORAGE.paths, kind)

    def replace(m: re.Match[str]) -> str:
        name = m.group(1)
        value = _render_value(values[name]) if name in values else None
        if value is None or not SAFE_SEGMENT.fullmatch(value):
            raise ValueError(f'storage_path("{kind}"): "{name}" is missing or not a plain segment')
        return value

    return PLACEHOLDER.sub(replace, template)

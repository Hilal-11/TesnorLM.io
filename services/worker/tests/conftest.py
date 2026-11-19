"""Shared test setup.

Settings are pinned to harmless values here, so tests never use real API keys or the main
Supabase project from the repo-root .env. The local-stack integration test builds its own store
from TEST_SUPABASE_* and refuses the main project's URL.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

os.environ["SUPABASE_URL"] = "http://127.0.0.1:9"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-role"
os.environ["OPENAI_API_KEY"] = "test-openai"
os.environ["ANTHROPIC_API_KEY"] = "test-anthropic"
os.environ["INNGEST_DEV"] = "1"
os.environ["WORKER_WARM_UP"] = "0"
os.environ.pop("INNGEST_SIGNING_KEY", None)

sys.path.insert(0, str(Path(__file__).parent))

from fixtures.make_fixtures import generate  # noqa: E402


@pytest.fixture(scope="session")
def pdfs() -> dict[str, Path]:
    return generate()


@pytest.fixture(scope="session")
def pdf_bytes(pdfs: dict[str, Path]) -> dict[str, bytes]:
    return {name: path.read_bytes() for name, path in pdfs.items()}


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "docling: runs real Docling conversions (slow, needs models)")
    config.addinivalue_line("markers", "stack: needs the local Supabase stack (TEST_SUPABASE_*)")

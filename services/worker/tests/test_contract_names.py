"""Worker code names stages and error codes only through the contract (checklist A5)."""

import ast
import re
from pathlib import Path

import pytest

from app.contract import CONTRACT, ERROR, STAGE

APP = Path(__file__).resolve().parents[1] / "app"
NAMES = set(CONTRACT.stages) | set(CONTRACT.errors)
LITERAL = re.compile(r"^(?:%s)$" % "|".join(sorted(NAMES - {"ready", "failed"})))


def sources():
    return [p for p in APP.glob("*.py") if p.name != "contract.py"]


@pytest.mark.parametrize("path", sources(), ids=lambda p: p.name)
def test_every_contract_name_used_exists(path):
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name):
            if node.value.id == "STAGE":
                assert node.attr in CONTRACT.stages, f"{path.name}: STAGE.{node.attr}"
            if node.value.id == "ERROR":
                assert node.attr in CONTRACT.errors, f"{path.name}: ERROR.{node.attr}"


@pytest.mark.parametrize("path", sources(), ids=lambda p: p.name)
def test_no_stage_or_error_literals(path):
    tree = ast.parse(path.read_text(encoding="utf-8"))
    found = [
        n.value
        for n in ast.walk(tree)
        if isinstance(n, ast.Constant) and isinstance(n.value, str) and LITERAL.match(n.value)
    ]
    assert found == [], f"{path.name} hard-codes {found}: use STAGE./ERROR. from app.contract"


def test_names_reject_unknowns():
    assert STAGE.parsing == "parsing" and ERROR.corrupt_pdf == "corrupt_pdf"
    with pytest.raises(AttributeError):
        _ = STAGE.thinking
    with pytest.raises(AttributeError):
        _ = ERROR.oops

from pathlib import Path

import pytest

from app.contract import error_copy
from app.errors import IngestError, NeedsPassword
from app.validate import check_size, validate_pdf

MB = 1024 * 1024


def check(path: Path, **kw):
    return validate_pdf(path, max_bytes=kw.get("max_bytes", 50 * MB), max_pages=kw.get("max_pages", 200))


@pytest.mark.parametrize(
    ("name", "code"),
    [
        # Interim until P3.7v2: disguised files are routed by type, damaged ones repaired first.
        ("not_pdf", "unsupported_type"),
        ("corrupt", "unreadable_after_repair"),
    ],
)
def test_unreadable_files_fail_with_their_code(pdfs, name, code):
    with pytest.raises(IngestError) as err:
        check(pdfs[name])
    assert err.value.code == code


def test_a_password_locked_pdf_waits_for_its_password(pdfs):
    with pytest.raises(NeedsPassword):
        check(pdfs["encrypted"])


def test_a_long_pdf_is_read_up_to_the_limit(pdfs):
    info = check(pdfs["too_many_pages"], max_pages=200)
    assert (info.pages, info.total_pages, info.capped) == (200, 201, True)
    assert check(pdfs["paper_basic"]).capped is False


def test_empty_file_says_so(tmp_path):
    empty = tmp_path / "empty.pdf"
    empty.write_bytes(b"")
    with pytest.raises(IngestError) as err:
        check(empty)
    assert err.value.code == "empty_file"
    assert error_copy("empty_file").message == "This file is empty."


def test_zero_page_pdf_is_unreadable(tmp_path):
    zero = tmp_path / "zero.pdf"
    zero.write_bytes(
        b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n"
        b"trailer<</Root 1 0 R>>\n%%EOF"
    )
    with pytest.raises(IngestError) as err:
        check(zero)
    assert err.value.code == "unreadable_after_repair"


def test_size_limit_message_matches_the_skill_example():
    with pytest.raises(IngestError) as err:
        check_size(120 * MB, 50 * MB)
    copy = error_copy(err.value.code, err.value.values)
    assert f"{copy.message} {copy.fix}" == (
        "This file is 120 MB. Your plan allows 50 MB per file. Split it, or upgrade for larger files."
    )


def test_oversized_file_on_disk(pdfs):
    with pytest.raises(IngestError) as err:
        check(pdfs["paper_basic"], max_bytes=1000)
    assert err.value.code == "file_too_large"


def test_born_digital_paper(pdfs):
    info = check(pdfs["paper_basic"])
    assert info.pages == 3
    assert info.scanned_pages == []
    assert len(info.sha256) == 64
    assert info.size == pdfs["paper_basic"].stat().st_size


def test_scanned_pages_are_found(pdfs):
    assert check(pdfs["scanned"]).scanned_pages == [1]
    assert check(pdfs["blank_scan"]).scanned_pages == [1]
    assert check(pdfs["logo_repeat"]).scanned_pages == []


def test_concurrent_validation_is_safe(pdfs):
    """PDFium isn't thread-safe; the queue runs two ingests at once (load test regression)."""
    from concurrent.futures import ThreadPoolExecutor

    names = ["paper_basic", "scanned", "logo_repeat", "paper_basic", "scanned", "logo_repeat"] * 2
    with ThreadPoolExecutor(6) as pool:
        results = list(pool.map(lambda n: check(pdfs[n]).pages, names))
    assert results == [{"paper_basic": 3, "scanned": 1, "logo_repeat": 4}[n] for n in names]

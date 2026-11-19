from pathlib import Path

import pytest

from app.contract import error_copy
from app.errors import IngestError
from app.validate import check_size, validate_pdf

MB = 1024 * 1024


def check(path: Path, **kw):
    return validate_pdf(path, max_bytes=kw.get("max_bytes", 50 * MB), max_pages=kw.get("max_pages", 200))


@pytest.mark.parametrize(
    ("name", "code"),
    [
        ("not_pdf", "not_pdf"),
        ("encrypted", "encrypted_pdf"),
        ("corrupt", "corrupt_pdf"),
        ("too_many_pages", "too_many_pages"),
    ],
)
def test_bad_files_fail_with_their_code(pdfs, name, code):
    with pytest.raises(IngestError) as err:
        check(pdfs[name])
    assert err.value.code == code


def test_too_many_pages_carries_values_for_the_message(pdfs):
    with pytest.raises(IngestError) as err:
        check(pdfs["too_many_pages"])
    assert err.value.values == {"pages": 201, "limit": 200}
    assert error_copy("too_many_pages", err.value.values).message == (
        "This PDF has 201 pages. The limit is 200 pages."
    )


def test_empty_file_is_not_a_pdf(tmp_path):
    empty = tmp_path / "empty.pdf"
    empty.write_bytes(b"")
    with pytest.raises(IngestError) as err:
        check(empty)
    assert err.value.code == "not_pdf"


def test_zero_page_pdf_is_corrupt(tmp_path):
    zero = tmp_path / "zero.pdf"
    zero.write_bytes(
        b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n"
        b"trailer<</Root 1 0 R>>\n%%EOF"
    )
    with pytest.raises(IngestError) as err:
        check(zero)
    assert err.value.code == "corrupt_pdf"


def test_size_limit_message_matches_the_skill_example():
    with pytest.raises(IngestError) as err:
        check_size(120 * MB, 50 * MB)
    copy = error_copy(err.value.code, err.value.values)
    assert f"{copy.message} {copy.fix}" == (
        "This file is 120 MB. The limit is 50 MB. Split the PDF or upload chapters separately."
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

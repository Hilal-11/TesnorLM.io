"""File checks before parsing (spec section 9, step "validate").

The worker is authoritative: the browser and API checks are only early feedback. Every
rejection is an IngestError with a contract code, so it is final (never retried).
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path

import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c

from app.errors import IngestError

# A page with less extractable text than this and an image on it counts as scanned.
SCANNED_MAX_CHARS = 20
HEADER_WINDOW = 1024  # PDF readers accept "%PDF-" anywhere in the first 1 KB


@dataclass(frozen=True)
class PdfInfo:
    pages: int
    size: int
    sha256: str
    scanned_pages: list[int] = field(default_factory=list)  # 1-based


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _size_mb(size: int) -> str:
    return f"{size / (1024 * 1024):.1f}".removesuffix(".0")


def check_size(size: int, max_bytes: int) -> None:
    if size > max_bytes:
        raise IngestError(
            "file_too_large",
            {"sizeMb": _size_mb(size), "limitMb": _size_mb(max_bytes)},
        )


def check_magic(path: Path) -> None:
    with path.open("rb") as f:
        head = f.read(HEADER_WINDOW)
    if b"%PDF-" not in head:
        raise IngestError("not_pdf")


def open_pdf(path: Path) -> pdfium.PdfDocument:
    try:
        return pdfium.PdfDocument(path)
    except pdfium.PdfiumError as exc:
        if getattr(exc, "err_code", None) == pdfium_c.FPDF_ERR_PASSWORD:
            raise IngestError("encrypted_pdf") from None
        raise IngestError("corrupt_pdf") from None


def _is_scanned(page: pdfium.PdfPage) -> bool:
    textpage = page.get_textpage()
    try:
        text = textpage.get_text_range() if textpage.count_chars() > 0 else ""
    finally:
        textpage.close()
    if len(text.strip()) >= SCANNED_MAX_CHARS:
        return False
    return any(True for _ in page.get_objects(filter=[pdfium_c.FPDF_PAGEOBJ_IMAGE], max_depth=2))


def scanned_pages(pdf: pdfium.PdfDocument) -> list[int]:
    found: list[int] = []
    for i in range(len(pdf)):
        page = pdf[i]
        try:
            if _is_scanned(page):
                found.append(i + 1)
        finally:
            page.close()
    return found


def validate_pdf(path: Path, *, max_bytes: int, max_pages: int) -> PdfInfo:
    """Size, magic bytes, encryption, corruption, page count; finds scanned pages."""
    size = path.stat().st_size
    check_size(size, max_bytes)
    if size == 0:
        raise IngestError("not_pdf")
    check_magic(path)
    pdf = open_pdf(path)
    try:
        try:
            pages = len(pdf)
        except Exception:  # noqa: BLE001 - a broken page tree
            raise IngestError("corrupt_pdf") from None
        if pages == 0:
            raise IngestError("corrupt_pdf")
        if pages > max_pages:
            raise IngestError("too_many_pages", {"pages": pages, "limit": max_pages})
        try:
            scanned = scanned_pages(pdf)
        except pdfium.PdfiumError:
            raise IngestError("corrupt_pdf") from None
    finally:
        pdf.close()
    return PdfInfo(pages=pages, size=size, sha256=file_sha256(path), scanned_pages=scanned)

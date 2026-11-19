"""Docling conversion (spec section 9, step "parse").

Parse progress (decision for spec section 17): Docling 2.150's `progress_callback` emits one
event per finished page (`completed_pages` of `total_pages`), so the whole PDF is converted in
one pass and the detail line counts real pages. Splitting into page ranges would break tables
and reading order across range boundaries, so it isn't used.

OCR (decision for P3.7): RapidOCR on ONNX Runtime. Its detection, classification and
recognition models ship inside the `rapidocr` wheel (no download at run time), it needs no
system packages (unlike Tesseract), and it is much lighter than EasyOCR's torch models.
OCR is switched on only when validation found scanned pages; born-digital PDFs never pay for it.

At most two converters exist per process (with and without OCR), created once and reused.
"""

from __future__ import annotations

import threading
import time
from collections.abc import Callable
from importlib.metadata import version
from pathlib import Path
from typing import Any

from app.errors import IngestError

PICTURE_SCALE = 2.0  # 144 dpi picture crops: sharp enough for captions, ≤ 1600 px after resize

_converters: dict[bool, Any] = {}
_lock = threading.Lock()


def parser_version() -> str:
    return f"docling {version('docling')}"


def get_converter(ocr: bool, timeout_s: int) -> Any:
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption

    with _lock:
        converter = _converters.get(ocr)
        if converter is None:
            options = PdfPipelineOptions(
                do_ocr=ocr,
                do_table_structure=True,
                generate_picture_images=True,
                images_scale=PICTURE_SCALE,
                document_timeout=float(timeout_s),
            )
            if ocr:
                options.ocr_options = RapidOcrOptions(backend="onnxruntime")
            converter = DocumentConverter(
                format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)}
            )
            _converters[ocr] = converter
        return converter


def warm_up(timeout_s: int | None = None) -> None:
    """Loads the layout and table models (used by /ready and at startup in production)."""
    if timeout_s is None:
        from app.settings import get_settings

        timeout_s = get_settings().parse_timeout_s
    get_converter(False, timeout_s).initialize_pipeline(_pdf_format())


def _pdf_format() -> Any:
    from docling.datamodel.base_models import InputFormat

    return InputFormat.PDF


def models_loaded() -> bool:
    return bool(_converters)


PageCallback = Callable[[int, int, int], None]  # (completed_pages, total_pages, page_no)


def convert(
    path: Path,
    *,
    ocr: bool,
    timeout_s: int,
    on_page: PageCallback | None = None,
    clock: Callable[[], float] = time.monotonic,
) -> Any:
    """Converts a PDF to a DoclingDocument. Raises IngestError for final problems."""
    from docling.datamodel.base_models import ConversionStatus

    converter = get_converter(ocr, timeout_s)

    def progress(event: Any) -> None:
        if on_page is not None and getattr(event, "kind", None) == "page_completed":
            on_page(int(event.completed_pages), int(event.total_pages), int(event.page_no))

    started = clock()
    result = converter.convert(path, raises_on_error=True, progress_callback=progress)
    elapsed = clock() - started
    if result.status == ConversionStatus.PARTIAL_SUCCESS and elapsed >= timeout_s * 0.95:
        raise IngestError("parse_timeout")
    if elapsed > timeout_s:
        raise IngestError("parse_timeout")
    if result.status not in (ConversionStatus.SUCCESS, ConversionStatus.PARTIAL_SUCCESS):
        raise RuntimeError(f"docling status {result.status}")
    return result.document


def has_text(doc: Any) -> bool:
    """Whether the body has any readable text (not just page furniture or pictures)."""
    from docling_core.types.doc import ContentLayer

    for item in doc.texts:
        if getattr(item, "content_layer", ContentLayer.BODY) != ContentLayer.BODY:
            continue
        if (item.text or "").strip():
            return True
    for table in doc.tables:
        if table.data and table.data.num_rows > 0:
            return True
    return False


def to_json(doc: Any) -> bytes:
    import json

    return json.dumps(doc.export_to_dict(), separators=(",", ":")).encode("utf-8")


def from_json(data: bytes) -> Any:
    import json

    from docling_core.types.doc import DoclingDocument

    return DoclingDocument.model_validate(json.loads(data))


MARKDOWN_CAP = 2_000_000  # characters kept in documents.markdown (full-context answers)


def to_markdown(doc: Any) -> str:
    from docling_core.types.doc import ImageRefMode

    text = doc.export_to_markdown(image_mode=ImageRefMode.PLACEHOLDER, image_placeholder="")
    return text[:MARKDOWN_CAP]

"""Figures from a parsed document (spec section 9, step "figures").

Every picture Docling found in the body becomes a candidate with its page, bounding box (PDF
points, top-left origin), label ("Figure 3") and the caption printed in the paper. Tiny images
and repeated logos are skipped, the largest `max_figures` are kept, and each is saved as WebP
(quality 85, at most 1600 px wide).
"""

from __future__ import annotations

import hashlib
import io
import re
from collections import Counter
from dataclasses import dataclass
from typing import Any

from PIL import Image

MIN_SIDE_PT = 40  # smaller than ~1.4 cm on the page: an icon or bullet, not a figure
MIN_AREA_PT = 72 * 72  # at least about one square inch
MIN_SIDE_PX = 64
LOGO_PAGES = 3  # the same image on this many pages is a logo or a running decoration
MAX_WIDTH_PX = 1600
WEBP_QUALITY = 85

LABEL = re.compile(r"^\s*(fig(?:ure)?|table|chart|diagram|plate|scheme)\.?\s*([0-9]+[a-z]?)", re.I)
LABEL_WORDS = {"fig": "Figure", "figure": "Figure"}


@dataclass
class Candidate:
    page: int
    bbox: dict[str, float]  # {page, l, t, r, b}: PDF points, origin top-left
    label: str | None
    paper_caption: str | None
    image: Image.Image
    area: float

    @property
    def top(self) -> float:
        return self.bbox["t"]


@dataclass
class SavedFigure:
    ordinal: int  # 1-based, reading order
    page: int
    bbox: dict[str, float]
    label: str | None
    paper_caption: str | None
    webp: bytes
    width: int
    height: int
    image_sha256: str


def label_of(caption: str | None) -> str | None:
    """'Fig. 3: Attention…' → 'Figure 3'; 'Table 2 shows…' → 'Table 2'."""
    if not caption:
        return None
    m = LABEL.match(caption)
    if not m:
        return None
    word = m.group(1).lower()
    return f"{LABEL_WORDS.get(word, word.capitalize())} {m.group(2)}"


def top_left_bbox(prov: Any, page_height: float) -> dict[str, float]:
    """Docling reports PDF provenance bottom-left; Phase 4 highlights expect top-left."""
    from docling_core.types.doc import CoordOrigin

    bbox = prov.bbox
    if bbox.coord_origin == CoordOrigin.BOTTOMLEFT:
        bbox = bbox.to_top_left_origin(page_height=page_height)
    return {
        "page": int(prov.page_no),
        "l": round(float(bbox.l), 2),
        "t": round(float(bbox.t), 2),
        "r": round(float(bbox.r), 2),
        "b": round(float(bbox.b), 2),
    }


def page_height(doc: Any, page_no: int) -> float:
    page = doc.pages.get(page_no)
    return float(page.size.height) if page is not None and page.size is not None else 792.0


def _fingerprint(image: Image.Image) -> bytes:
    """An average hash: the same logo rendered on several pages gives the same bits."""
    small = image.convert("L").resize((16, 16))
    pixels = list(small.tobytes())
    mean = sum(pixels) / len(pixels)
    return bytes(1 if p > mean else 0 for p in pixels)


def candidates(doc: Any) -> list[Candidate]:
    from docling_core.types.doc import ContentLayer

    found: list[Candidate] = []
    for picture in doc.pictures:
        if getattr(picture, "content_layer", ContentLayer.BODY) != ContentLayer.BODY:
            continue
        if not picture.prov:
            continue
        image = picture.get_image(doc)
        if image is None:
            continue
        prov = picture.prov[0]
        bbox = top_left_bbox(prov, page_height(doc, prov.page_no))
        width_pt = bbox["r"] - bbox["l"]
        height_pt = bbox["b"] - bbox["t"]
        caption = (picture.caption_text(doc) or "").strip() or None
        found.append(
            Candidate(
                page=int(prov.page_no),
                bbox=bbox,
                label=label_of(caption),
                paper_caption=caption,
                image=image,
                area=max(0.0, width_pt) * max(0.0, height_pt),
            )
        )
    return found


def select(found: list[Candidate], max_figures: int) -> tuple[list[Candidate], int]:
    """Drops tiny images and repeated logos, keeps the largest. Returns (kept, skipped)."""
    usable = [
        c
        for c in found
        if c.area >= MIN_AREA_PT
        and (c.bbox["r"] - c.bbox["l"]) >= MIN_SIDE_PT
        and (c.bbox["b"] - c.bbox["t"]) >= MIN_SIDE_PT
        and min(c.image.size) >= MIN_SIDE_PX
    ]
    prints = {id(c): _fingerprint(c.image) for c in usable}
    pages_per_print: dict[bytes, set[int]] = {}
    for c in usable:
        pages_per_print.setdefault(prints[id(c)], set()).add(c.page)
    repeated = {fp for fp, pages in pages_per_print.items() if len(pages) >= LOGO_PAGES}
    usable = [c for c in usable if prints[id(c)] not in repeated]
    kept = sorted(usable, key=lambda c: c.area, reverse=True)[:max_figures]
    kept.sort(key=lambda c: (c.page, c.top))
    return kept, len(found) - len(kept)


def to_webp(image: Image.Image) -> tuple[bytes, int, int]:
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGB")
    if image.width > MAX_WIDTH_PX:
        height = round(image.height * MAX_WIDTH_PX / image.width)
        image = image.resize((MAX_WIDTH_PX, height), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=WEBP_QUALITY, method=4)
    return buffer.getvalue(), image.width, image.height


def extract(doc: Any, max_figures: int) -> tuple[list[SavedFigure], int]:
    kept, skipped = select(candidates(doc), max_figures)
    saved: list[SavedFigure] = []
    for i, c in enumerate(kept, start=1):
        webp, width, height = to_webp(c.image)
        saved.append(
            SavedFigure(
                ordinal=i,
                page=c.page,
                bbox=c.bbox,
                label=c.label,
                paper_caption=c.paper_caption,
                webp=webp,
                width=width,
                height=height,
                image_sha256=hashlib.sha256(webp).hexdigest(),
            )
        )
    return saved, skipped


def repeated_count(found: list[Candidate]) -> int:
    """How many candidates share a fingerprint with another page (for logs and tests)."""
    counts = Counter(_fingerprint(c.image) for c in found)
    return sum(n for n in counts.values() if n >= LOGO_PAGES)

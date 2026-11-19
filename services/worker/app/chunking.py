"""Page-aware chunks (spec section 10).

Docling's HybridChunker splits the parsed document by structure (sections, paragraphs, tables,
lists) and merges small neighbours up to ~400 tokens, measured with the embedding model's own
tokenizer (cl100k_base for text-embedding-3-*). Every chunk keeps its pages, its positions
(bboxes: PDF points, top-left origin, pages from 1) and its heading path. Tables are serialized
as Markdown. Running headers, footers and page numbers are dropped. Each stored figure also
gets one caption chunk so it can be found by search.
"""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

import tiktoken

MAX_TOKENS = 400
ENCODING = "cl100k_base"  # text-embedding-3-small / -large

PAGE_NUMBER = re.compile(r"^\s*(page\s*)?[0-9ivxlcdm]{1,6}(\s*(of|/)\s*[0-9]{1,6})?\s*$", re.I)
REPEAT_MIN_PAGES = 3
REPEAT_MAX_CHARS = 120


@lru_cache(maxsize=1)
def encoder() -> tiktoken.Encoding:
    return tiktoken.get_encoding(ENCODING)


def count_tokens(text: str) -> int:
    return len(encoder().encode(text, disallowed_special=()))


@dataclass
class ChunkRow:
    chunk_index: int
    content: str
    embed_text: str
    kind: str  # text | table | figure_caption
    page_start: int
    page_end: int
    bboxes: list[dict[str, float]] = field(default_factory=list)
    headings: list[str] = field(default_factory=list)
    token_count: int = 0
    figure_id: str | None = None

    @property
    def section(self) -> str | None:
        return " > ".join(self.headings) or None


def is_boilerplate(text: str) -> bool:
    stripped = text.strip()
    return len(stripped) < 3 or bool(PAGE_NUMBER.match(stripped))


def _normalise(text: str) -> str:
    return re.sub(r"\d+", "#", text.strip().lower())


def mark_running_lines(doc: Any) -> int:
    """Moves headers/footers Docling missed to the furniture layer: short lines repeated on many
    pages ("Preprint · Under review", "Vaswani et al. 3") and bare page numbers."""
    from docling_core.types.doc import ContentLayer

    pages_by_text: dict[str, set[int]] = defaultdict(set)
    body = [t for t in doc.texts if getattr(t, "content_layer", ContentLayer.BODY) == ContentLayer.BODY]
    for item in body:
        text = (item.text or "").strip()
        if text and len(text) <= REPEAT_MAX_CHARS and item.prov:
            pages_by_text[_normalise(text)].add(item.prov[0].page_no)
    page_count = max(1, len(doc.pages))
    threshold = max(REPEAT_MIN_PAGES, page_count // 2)
    repeated = {k for k, pages in pages_by_text.items() if len(pages) >= threshold}
    moved = 0
    for item in body:
        text = (item.text or "").strip()
        if not text:
            continue
        if PAGE_NUMBER.match(text) or _normalise(text) in repeated:
            item.content_layer = ContentLayer.FURNITURE
            moved += 1
    return moved


def _bbox(prov: Any, doc: Any) -> dict[str, float]:
    from app.figures import page_height, top_left_bbox

    return top_left_bbox(prov, page_height(doc, prov.page_no))


def _chunker() -> Any:
    from docling_core.transforms.chunker.hierarchical_chunker import (
        ChunkingDocSerializer,
        ChunkingSerializerProvider,
    )
    from docling_core.transforms.chunker.hybrid_chunker import HybridChunker
    from docling_core.transforms.chunker.tokenizer.openai import OpenAITokenizer
    from docling_core.transforms.serializer.markdown import MarkdownTableSerializer

    class MarkdownTables(ChunkingSerializerProvider):
        def get_serializer(self, doc: Any) -> ChunkingDocSerializer:
            return ChunkingDocSerializer(doc=doc, table_serializer=MarkdownTableSerializer())

    return HybridChunker(
        tokenizer=OpenAITokenizer(tokenizer=encoder(), max_tokens=MAX_TOKENS),
        serializer_provider=MarkdownTables(),
        merge_peers=True,
        repeat_table_header=True,
    )


def text_chunks(doc: Any, title: str, page_count: int) -> list[ChunkRow]:
    from docling_core.types.doc import DocItemLabel

    mark_running_lines(doc)
    chunker = _chunker()
    rows: list[ChunkRow] = []
    for chunk in chunker.chunk(dl_doc=doc):
        text = (chunk.text or "").strip()
        if is_boilerplate(text):
            continue
        items = list(chunk.meta.doc_items or [])
        provs = [p for item in items for p in (item.prov or [])]
        pages = sorted({int(p.page_no) for p in provs if 1 <= int(p.page_no) <= page_count})
        if not pages:
            continue  # no position on the page: can't be cited
        bboxes = [_bbox(p, doc) for p in provs if 1 <= int(p.page_no) <= page_count]
        headings = [h for h in (chunk.meta.headings or []) if h]
        kind = "table" if any(item.label == DocItemLabel.TABLE for item in items) else "text"
        context = chunker.contextualize(chunk=chunk).strip()
        rows.append(
            ChunkRow(
                chunk_index=len(rows),
                content=text,
                embed_text=f"Document: {title}\n{context}",
                kind=kind,
                page_start=pages[0],
                page_end=pages[-1],
                bboxes=bboxes,
                headings=headings,
                token_count=count_tokens(text),
            )
        )
    return rows


def caption_text(figure: dict[str, Any]) -> str:
    """'Figure 3 (page 5): Scaled dot-product attention.\n<description>'"""
    from app.figures import LABEL

    label = figure.get("label") or "Figure"
    head = f"{label} (page {figure['page']})"
    caption = (figure.get("paper_caption") or "").strip()
    # The printed caption usually starts with its own label ("Figure 3: …"): don't repeat it.
    m = LABEL.match(caption)
    if m and figure.get("label"):
        caption = caption[m.end() :].lstrip(" :.-–—").strip()
    first = f"{head}: {caption}" if caption else head
    description = (figure.get("description") or "").strip()
    return f"{first}\n{description}" if description else first


def figure_chunks(figures: list[dict[str, Any]], title: str, start_index: int) -> list[ChunkRow]:
    rows: list[ChunkRow] = []
    for i, figure in enumerate(sorted(figures, key=lambda f: f["ordinal"])):
        content = caption_text(figure)
        rows.append(
            ChunkRow(
                chunk_index=start_index + i,
                content=content,
                embed_text=f"Document: {title}\n{content}",
                kind="figure_caption",
                page_start=int(figure["page"]),
                page_end=int(figure["page"]),
                bboxes=[figure["bbox"]] if figure.get("bbox") else [],
                headings=[],
                token_count=count_tokens(content),
                figure_id=figure["id"],
            )
        )
    return rows


def build_chunks(doc: Any, title: str, page_count: int, figures: list[dict[str, Any]]) -> list[ChunkRow]:
    """Deterministic for a given doc.json and figure set, so retries rebuild the same rows."""
    rows = text_chunks(doc, title, page_count)
    return rows + figure_chunks(figures, title, len(rows))

"""
TensorLM ingestion worker.

POST /ingest {"document_id": "..."}  (header: x-worker-secret)
  1. download file from Supabase Storage
  2. parse with Docling -> Markdown (tables, equations, layout preserved)
  3. split by headings into contextual chunks
  4. embed chunks (OpenAI) and store in Postgres (pgvector)

MVP runs ingestion as a FastAPI background task.
Move to Inngest / Trigger.dev when you have real traffic.
"""
import os
import re
import tempfile
from pathlib import Path

import tiktoken
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from openai import OpenAI
from pydantic import BaseModel
from supabase import create_client

load_dotenv(Path(__file__).resolve().parents[3] / ".env")
load_dotenv()

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
WORKER_SECRET = os.environ["WORKER_SECRET"]
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
openai_client = OpenAI()
encoder = tiktoken.get_encoding("cl100k_base")

app = FastAPI(title="TensorLM worker")

_converter = None


def get_converter():
    """Docling loads ML models on first use — create it lazily, once."""
    global _converter
    if _converter is None:
        from docling.document_converter import DocumentConverter
        _converter = DocumentConverter()
    return _converter


class IngestRequest(BaseModel):
    document_id: str


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/ingest")
def ingest(req: IngestRequest, background: BackgroundTasks, x_worker_secret: str = Header(None)):
    if x_worker_secret != WORKER_SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")
    background.add_task(process_document, req.document_id)
    return {"queued": True}


# ───────────────────────── pipeline ─────────────────────────

def set_status(document_id: str, status: str, **extra):
    supabase.table("documents").update({"status": status, **extra}).eq("id", document_id).execute()


def process_document(document_id: str):
    try:
        set_status(document_id, "processing")
        doc = supabase.table("documents").select("*").eq("id", document_id).single().execute().data

        # 1. download
        data = supabase.storage.from_("documents").download(doc["file_path"])
        suffix = Path(doc["file_path"]).suffix or ".pdf"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(data)
            tmp_path = f.name

        # 2. parse
        result = get_converter().convert(tmp_path)
        markdown = result.document.export_to_markdown()
        os.unlink(tmp_path)

        # 3. chunk
        chunks = chunk_markdown(markdown, doc_title=doc["title"])

        # 4. embed + store
        rows = []
        for batch_start in range(0, len(chunks), 64):
            batch = chunks[batch_start:batch_start + 64]
            # embed the contextualized text (title + section + content)
            inputs = [c["embed_text"] for c in batch]
            resp = openai_client.embeddings.create(model=EMBEDDING_MODEL, input=inputs)
            for c, e in zip(batch, resp.data):
                rows.append({
                    "document_id": document_id,
                    "notebook_id": doc["notebook_id"],
                    "chunk_index": c["index"],
                    "section": c["section"],
                    "content": c["content"],
                    "embedding": e.embedding,
                })

        supabase.table("chunks").delete().eq("document_id", document_id).execute()
        for i in range(0, len(rows), 100):
            supabase.table("chunks").insert(rows[i:i + 100]).execute()

        set_status(
            document_id, "ready",
            markdown=markdown,
            token_count=len(encoder.encode(markdown)),
            error=None,
        )
    except Exception as exc:  # noqa: BLE001
        set_status(document_id, "failed", error=str(exc)[:1000])
        raise


HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
MAX_TOKENS = 400       # target chunk size
OVERLAP_TOKENS = 50


def chunk_markdown(markdown: str, doc_title: str):
    """
    Structure-aware chunking:
    - split on headings so a chunk never mixes two sections
    - pack paragraphs up to MAX_TOKENS
    - keep the heading path as context (used in embedding + citations)
    """
    sections = []           # (heading_path, text)
    path: list[str] = []
    buffer: list[str] = []

    def flush():
        text = "\n".join(buffer).strip()
        if text:
            sections.append((" > ".join(path), text))
        buffer.clear()

    for line in markdown.splitlines():
        m = HEADING_RE.match(line)
        if m:
            flush()
            level = len(m.group(1))
            path[:] = path[: level - 1] + [m.group(2).strip()]
        else:
            buffer.append(line)
    flush()

    chunks = []
    for section, text in sections:
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
        current: list[str] = []
        current_tokens = 0
        for p in paragraphs:
            t = len(encoder.encode(p))
            if current and current_tokens + t > MAX_TOKENS:
                chunks.append((section, "\n\n".join(current)))
                # simple overlap: carry the last paragraph if it is small
                last = current[-1]
                current = [last] if len(encoder.encode(last)) <= OVERLAP_TOKENS else []
                current_tokens = sum(len(encoder.encode(x)) for x in current)
            current.append(p)
            current_tokens += t
        if current:
            chunks.append((section, "\n\n".join(current)))

    return [
        {
            "index": i,
            "section": section or None,
            "content": content,
            # contextual retrieval: the embedding knows where this chunk lives
            "embed_text": f"Document: {doc_title}\nSection: {section or 'Introduction'}\n\n{content}",
        }
        for i, (section, content) in enumerate(chunks)
    ]

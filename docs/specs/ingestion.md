# Ingestion spec (Phase 3, v2)

How any source becomes **Ready to ask** within seconds and **Ready** minutes later: page-aware chunks, figures and captions in the database,
with honest live progress and errors that say what happened and how to fix it. Every later feature
(cited answers, marker highlights, lessons, quizzes) reads what this pipeline writes.

- **Contract (version 2):** [`contracts/ingestion.json`](../../contracts/ingestion.json) is the only
  place source types, stage names, transitions, learner words, detail lines, error and notice copy,
  events, limits and storage paths are defined. TypeScript: `apps/web/src/lib/ingestion/contract.ts`. Python:
  `services/worker/app/contract.py`. See [Changing the contract](#15-changing-the-contract).
- **Product flow:** [`product-flow.md`](product-flow.md). **Plan:**
  `docs/plans/TensorLM-v2-Part-A-Phases-3-4.md` (task ids P3.xv2 below).
- **UI rules:** `.claude/skills/tensorlm-design/SKILL.md` (sections 8.2, 8.4, 9, 10.1) overrides
  anything here about how things look or read.

> **v2 status.** This spec describes the target. Until a task lands, the v1 code runs on the v2
> contract with these interim behaviours: one Docling pass reported as `parsing_deep` (no fast pass
> until P3.8v2); only PDFs upload and anything else ends as `unsupported_type` (P3.5v2, P3.7v2);
> damaged PDFs end as `unreadable_after_repair` without a repair attempt (P3.7v2); password-locked
> PDFs wait in `needs_password` with no way to unlock yet (P3.7v2); PDFs over `MAX_PAGES` are read
> up to the limit, logged but without the `pages_capped` notice (P3.1v2 adds `documents.notices`).

## 1. Goals and non-goals

**Milestone (v2).** From Home, a person adds any supported source (files, web, YouTube, Drive, copied
text, web search); every PDF is accepted; text is askable within seconds (fast pass) and fully
enriched later (deep pass); an overview and 5 suggested questions appear; 5 uploads at once all
finish.

Goals:

1. Accepting: nothing is rejected at upload except by the storage plan's size limit. The worker
   tries every path (route by real type, open permission locks, ask for the password, repair, OCR,
   batch huge files) before a source ends in **Couldn't read**, and then it says why and what to do.
2. Fast: a 30-page text PDF is **Ready to ask** in ≤ 10 s on the production worker; the deep pass
   improves it in the background and swaps in atomically.
3. Reliable: no lost jobs, no duplicated chunks, no orphaned files, no zombie runs.
4. Honest: progress shows real counts ("Reading page 18 of 42"), never a fake percentage; partial
   results carry a notice ("TensorLM read the first 2000 of 2400 pages.").
5. Citable: every chunk keeps its position (pages and bounding boxes, slide numbers, sheet/column, or
   video timestamps); citations made during the fast pass still resolve after the deep swap.
6. Safe and private: malicious, huge or broken files fail cleanly and can't take the worker down;
   each person sees only their own sources; passwords, tokens and content never reach logs.

Non-goals (Phase 3): answering questions (Phase 4); notes (Phase 5); per-plan limits beyond the size
limit (Phase 8: one free limit for now); collaboration or sharing; OCR languages other than English
by default (configurable).

## 2. Words used here

| Term | Meaning |
| --- | --- |
| Source | One thing a person added: a file, a link, a Drive file or copied text (`documents` row). |
| Source type | What the source is, from the contract's `sourceTypes` (section 2.1). |
| Ingest run | One attempt to process a source, identified by `ingest_run_id` (uuid). A new source or a re-process starts a new run. All worker output is keyed by `document_id` + `run_id`. |
| Fast pass / deep pass | The two passes of one run (section 9). The fast pass publishes text first (`finalize_fast_pass`); the deep pass replaces it (`finalize_ingest`). |
| Askable | The source answers questions: its fast pass (or a previous run) is published. |
| Stage | Where a run is in the stage machine (section 4). Stored in `documents.stage`. |
| Notice | A note on a usable source that is partial or was repaired (section 6.1). |
| Current run | The run whose id is in `documents.ingest_run_id`. Output of any other run is stale. |

### 2.1 Source types

From the contract's `sourceTypes`: a label, an origin, the unit citations use, and (for files) the
extensions and MIME types that suggest the type. Extensions are only a hint: preflight sniffs the
bytes and routes by the real type (a PNG renamed `.pdf` is read as an image).

| Type | Label | Origin | Citation unit | Extensions |
| --- | --- | --- | --- | --- |
| pdf | PDF | file | page | .pdf |
| docx | Word | file | heading | .docx |
| pptx | PowerPoint | file | slide | .pptx |
| xlsx | Excel | file | sheet (+ column) | .xlsx, .xlsm |
| csv | CSV | file | column | .csv, .tsv |
| json | JSON | file | path | .json, .jsonl, .ndjson |
| image | Image | file | — | .png, .jpg, .jpeg, .webp, .gif, .heic, .heif, .tif, .tiff, .bmp |
| text | Text | file | heading | .txt, .text, .adoc, .asciidoc |
| markdown | Markdown | file | heading | .md, .markdown |
| html | Web page file | file | heading | .html, .htm |
| web | Website | link | section | — |
| youtube | YouTube | link | time (12:34) | — |
| gdrive | Google Drive | drive | that of the exported file | — |
| pasted_text | Copied text | text | heading | — |

A file whose type TensorLM can't read (say `.ppt` or `.doc`) is still uploaded and kept, and ends as
`unsupported_type` with a suggestion. A Drive file records the exported format in `origin_meta`
and is read with that format's pipeline.

## 3. Flow

```text
Browser                         Web API (Next.js)                Supabase                 Inngest              Worker (FastAPI)
───────                         ─────────────────                ────────                 ───────              ────────────────
pre-check (type, size, sha256)
POST /api/notebooks/:id/documents ─▶ auth, ownership, quota,
                                    duplicate check
                                    insert documents row ───────▶ stage = uploading
                              ◀──── {documentId, storagePath}
TUS upload (user's session) ─────────────────────────────────────▶ Storage documents/
                                                                 <user>/<doc>/source.pdf
POST /api/documents/:id/uploaded ─▶ object exists + size ok
                                    stage = queued ─────────────▶
                                    send document/uploaded ──────────────────────────────▶ queue
                                                                                          ingest-document ─▶ validate
                                                                                                             parse (+ OCR)
                                                                 ◀──── set_document_stage ────────────────── figures
                                                                       (≤ 1/s per document)                  captions
                                                                                                             chunk + embed
                                                                 ◀──── finalize_ingest (atomic swap) ─────── finalize
Realtime postgres_changes ◀───────────────────────────────────── documents row changes
Source card: Uploading → Reading → Indexing → Ready
```

1. **Browser pre-checks** (instant feedback, never trusted): extension and MIME, size, SHA-256 (Web
   Crypto in a Web Worker), optional quick page count and encryption check with pdf.js.
2. **Create** `POST /api/notebooks/[id]/documents {filename, size, sha256, force?}`: requireUser,
   notebook owned and not deleted, size ≤ limit, `.pdf`, quota, duplicate check (unless `force`).
   Inserts the row with `stage = uploading`, a new `ingest_run_id`, and `storage_path` from the
   contract's `source` path. Returns `{documentId, storagePath, bucket}`.
3. **Upload** straight to Supabase Storage with resumable TUS uploads and the person's own session
   (6 MB chunks, resume after network loss). The API never streams file bytes. Storage RLS limits
   each person to their own first folder.
4. **Confirm** `POST /api/documents/[id]/uploaded`: checks the object exists with the expected size,
   moves the run to `queued`, sends `document/uploaded`.
5. **Process**: the queue runs the worker's `ingest-document` function step by step (section 9).
   Each step reports progress through `set_document_stage()`.
6. **Finish**: `finalize_ingest()` swaps the new run's chunks and figures in and marks the document
   Ready in one transaction. A failure sets `failed` with an error code from the contract.
7. **Watch**: the notebook page subscribes to Realtime changes on its documents (RLS limits them to
   the owner's rows), with polling every 5 s as a fallback while disconnected.

Cancel during upload: `POST /api/documents/[id]/cancel` deletes the partial object and the row.

## 4. Stage machine

```text
                       ┌──────────── needs_password ◀─┐ (password given: validate again)
                       ▼                              │
uploading ─▶ queued ─▶ validating ─┬─▶ parsing_fast ─▶ fast_ready ─┬─▶ parsing_deep ─┐
                                   ├─▶ repairing ─▶ (fast, deep     ├─▶ ready (text)  ├─▶ ocr ─┐
                                   │                 or ocr)        └─▶ ocr           │        ▼
                                   ├─▶ ocr (scans) ─▶ fast_ready                       └──▶ reading_figures ─▶ indexing ─▶ ready
                                   └─▶ parsing_deep (no fast pass)
every stage except ready ─────────────────────────────────────────────────────────────▶ failed
```

| From | Allowed next stages |
| --- | --- |
| uploading | queued, failed |
| queued | validating, failed |
| validating | repairing, needs_password, parsing_fast, parsing_deep, ocr, failed |
| repairing | parsing_fast, parsing_deep, ocr, failed |
| needs_password | validating, failed |
| parsing_fast | fast_ready, ocr, failed |
| fast_ready | parsing_deep, ocr, reading_figures, ready, failed |
| parsing_deep | ocr, reading_figures, indexing, failed |
| ocr | fast_ready, reading_figures, indexing, failed |
| reading_figures | indexing, failed |
| indexing | ready, failed |
| ready | — (terminal) |
| failed | — (terminal) |

Paths:

- **Text PDF:** validating → parsing_fast → fast_ready → parsing_deep → (ocr for a few scanned
  pages) → reading_figures → indexing → ready.
- **Scanned PDF or image:** validating → ocr → fast_ready (OCR text published) → reading_figures →
  indexing → ready. Scans skip the fast pass because there's no text layer.
- **Text formats** (TXT, Markdown, HTML, DOCX, copied text, web snapshots, transcripts): their single
  pass is the fast pass: validating → parsing_fast → fast_ready → ready.
- **Password:** validating → needs_password → (password given) → validating → …
- **Damaged:** validating → repairing → parsing_fast / parsing_deep / ocr (rendered pages).
- **No fast pass** (fast pass disabled or not possible): validating → parsing_deep → … → ready.

Rules:

1. **Transitions apply within one run.** A new source starts its run at `uploading` (files) or
   `queued` (links, Drive, copied text); a re-process starts a new run at `queued`. Starting a run is
   done by the API (it sets the new `ingest_run_id`), never by `set_document_stage()`.
2. **Same stage = progress update.** Reporting the current stage again only updates progress and
   detail. Progress never goes backwards within a run.
3. **Stale runs are ignored.** `set_document_stage()` does nothing when `p_run_id` isn't the current
   run, and when the move isn't in the table above. The SQL function mirrors this table
   (`ingest_transition_allowed`, migration 0006); `tests/rls` checks it against the contract.
4. **Publishing is a function, not a move.** `fast_ready` is entered only by `finalize_fast_pass()`
   and `ready` only by `finalize_ingest()` (P3.1v2), so a source is never askable half-written.
5. **A deep pass never takes an askable source away.** When the deep pass fails after `fast_ready`,
   the fast run is finalized as Ready with the `deep_failed` notice instead of failing the source.
6. **needs_password waits.** It isn't a failure: the run stops until `document/password-provided`
   arrives, then validates again. A wrong password keeps the stage and sets `error_code =
   password_wrong` (or `password_attempts` after 5 tries in 15 minutes) for the inline message.
7. **Enum order.** Postgres can't reorder enum values, so the contract keeps the database's order
   (`parsing_deep` before `ocr`). The worker's "never move backwards" check uses this order; P3.8v2
   replaces it with the transition table, because `ocr → fast_ready` goes back in order.

## 5. Stages in the interface

People see a learner word and a detail line with real counts. Detail lines come from the contract's
`details` templates; when a count is missing the fallback is shown. When the source is already
**askable** (its fast pass or a previous run is published), the stages that improve it use the
contract's `askable` word and lines instead ("Ready to ask · improving page 3 of 30").

| Stage | Word | Detail line (template) | Fallback | When askable | DB progress band |
| --- | --- | --- | --- | --- | --- |
| uploading | Uploading | Uploading · {percent}% | Uploading | — | 0 (bytes progress is local to the uploading browser) |
| queued | Queued | Waiting to start | — | — | 0 |
| validating | Reading | Checking the file | — | — | 0–5 |
| repairing | Repairing file | Repairing the file | — | — | 0–5 |
| needs_password | Needs password | Enter the password to open this PDF | — | — | unchanged |
| parsing_fast | Reading | Reading page {page} of {pages} | Reading the text | — | 5–45 by pages |
| fast_ready | Ready to ask | Ready to ask · improving tables and figures | — | — | 45 |
| parsing_deep | Improving | Reading tables and figures · page {page} of {pages} | Reading tables and figures | Ready to ask · improving page {page} of {pages} | 5–45 (after a fast pass: P3.8v2) |
| ocr | Running OCR | Running OCR on page {page} of {pages} ({pages} = scanned pages) | Running OCR | Ready to ask · improving tables and figures | 5–45 |
| reading_figures | Reading figures | Reading figures · {done} of {total} | Reading figures | Ready to ask · reading figures {done} of {total} | 45–65 by figures |
| indexing | Indexing | Indexing {passages} passages | Indexing passages | Ready to ask · improving tables and figures | 65–99 by passages written |
| ready | Ready | {pages} pages · Ready | Ready | — | 100 |
| failed | Couldn't read | (the error's message and fix, section 6) | — | — | unchanged |

Templates support `{name}` and a count-based word, `{pages:page|pages}` ("1 page · Ready"). Values
are strings or whole numbers; anything else counts as missing, so the fallback shows. Producers
format decimals themselves (`sizeMb: "63.4"`). Loaders: `uiWord(stage, {askable})`,
`detailLine(stage, vars, {askable})` (TS) and `ui_word(stage, askable=…)`, `detail_line(stage,
values, askable=…)` (Python). Slide and sheet wording for Ready ("12 slides · Ready") is decided in
P3.10v2.

The worker writes the rendered line into `documents.stage_detail` (≤ 1 write per second per
document; stage changes are written at once). The browser renders `uploading` lines itself and
chooses the askable line from `documents.fast_ready_at` / `ready_run_id` (P3.1v2).

## 6. Errors

An error is the end of every path, not the first answer: the v1 rejections `not_pdf`,
`encrypted_pdf`, `corrupt_pdf` and `too_many_pages` are gone (they became routing, the password
prompt, repair and batching). Every failure has a code from the contract. The interface shows the
**message** (what happened), the **fix** (what to do) and, where there is one, an **action** button.
Never "Something went wrong". `autoRetry` says whether the queue retries the step by itself.

| Code | Message | Fix | Actions | Raised by | Auto-retry |
| --- | --- | --- | --- | --- | --- |
| password_wrong | That password didn't open this PDF. | Check it and try again. | Unlock | password route / worker (stage stays `needs_password`) | no |
| password_attempts | Too many wrong passwords. You can try again in {minutes} minutes. | Wait a little, then enter the password again. | — | password route (5 tries, 15 min lock) | no |
| unreadable_after_repair | We couldn't read this file, even after trying to repair it. | Try again, or upload a different copy (re-download or re-export it). | Try again · Upload a different copy | worker | no |
| no_text_after_ocr | We couldn't find readable text, even with OCR. | Upload a clearer scan, or paste the text instead. | Upload a different copy · Paste the text | worker | no |
| empty_file | This file is empty. | Choose the file again, or re-download it. | Upload a different copy | browser, worker | no |
| unsupported_type | TensorLM can't read this type of file yet. | Save it as PDF, Word, text or Markdown, then add it again. | Upload a different copy | worker (browser and API until P3.5v2) | no |
| source_unreachable | We couldn't open this page (it may need a login). | Paste the text instead. | Try again · Paste the text | worker (web, Drive) | no |
| transcript_unavailable | We couldn't get a transcript for this video. | Paste the transcript instead. | Paste the text | worker (YouTube) | no |
| file_too_large | This file is {sizeMb} MB. Your plan allows {limitMb} MB per file. | Split it, or upgrade for larger files. | See plans | browser, API, worker | no |
| quota_exceeded | This notebook has reached its limit of {limit} sources. | Remove a source, then add this one. | — | API | no |
| duplicate_file | This file is already in this notebook. | Open the copy you added, or add it again anyway. | Open it · Add anyway | API | no |
| parse_timeout | This file took too long to read. | Try again, or split it into smaller parts. | Try again | worker (only when nothing is askable) | no |
| upload_interrupted | The upload stopped. | Check your connection, then resume the upload. | Resume upload | browser, stale-upload sweeper | no |
| internal | We couldn't finish reading this file. | Try again in a moment. | Try again | anything unexpected (logged) | yes |

- The skill's size example reads as message + fix: "This file is 120 MB. Your plan allows 50 MB per
  file. Split it, or upgrade for larger files." (a test asserts it). "See plans" links to a
  placeholder until Phase 8.
- Values for an error are stored in `documents.error_vars` (jsonb) next to `error_code`, so the
  copy can change without touching stored rows.
- Unknown codes render as `internal`, including v1 codes still stored on old rows; their "Try again"
  re-processes the source through the v2 paths, which is the right outcome.
- Raw exception text never reaches people or the database. "Try again" is a re-process (section 11).

### 6.1 Notices

A notice sits on a source that works but is partial or was changed to be read. Stored in
`documents.notices` (jsonb list of `{code, vars}`, P3.1v2); copy from the contract's `notices`
(`noticeCopy()` / `notice_copy()`; unknown codes are dropped).

| Code | Message | Fix |
| --- | --- | --- |
| repaired | This file was damaged. TensorLM repaired it before reading. | — |
| pages_capped | TensorLM read the first {limit} of {pages} pages. | Split the file to read the rest. |
| pages_skipped | {count} pages couldn't be read. | Upload a different copy to read them. |
| deep_failed | Tables and figures couldn't be improved. Answers still use the text. | Try again to improve them. |

## 7. Limits

Defaults live in the contract's `limits`; environment variables override them where listed. The
server and worker enforce them; the browser only gives early feedback.

| Limit | Default | Env | Enforced by |
| --- | --- | --- | --- |
| File size (the only upload rejection) | 50 MB (Supabase free plan) | `MAX_UPLOAD_MB` | browser (instant), API (declared and stored size), worker |
| Pages read per file | 2000 (beyond it: read the first 2000, `pages_capped` notice) | `MAX_PAGES` | worker |
| Fast-pass page batch | 50 pages | `FAST_PASS_PAGE_BATCH` | worker |
| Files per drop | 50 (3 upload in parallel, the rest wait as Queued) | — | browser |
| Sources per notebook (free) | 20 | `MAX_SOURCES_FREE` | API |
| Password attempts | 5, then a 15 min lock | — | password route |
| Password lifetime in Redis | 600 s, deleted on first read | — | password route, worker |
| Web page fetch | 10 MB, 15 s, 5 redirects (each re-checked) | — | worker |
| Suggested questions | 5 | — | insights function |
| Insights debounce | 20 s | — | insights function |
| Parse time (incl. OCR) | 10 min | `PARSE_TIMEOUT_S` | worker → `parse_timeout` (or `deep_failed` when askable) |
| Figures per document | 40 (largest by area) | — | worker |

The source quota counts a notebook's sources that are not deleted and not failed.

## 8. Storage layout

| Bucket | Who can access | Path (contract `storage.paths`) | Content |
| --- | --- | --- | --- |
| `documents` (private, 50 MB, `application/pdf`, `image/png`, `image/webp`) | owner via RLS (first folder = `auth.uid()`), worker via service role | `{userId}/{documentId}/source.pdf` | the original upload |
|  |  | `{userId}/{documentId}/figures/{runId}/{n}.webp` | extracted figures (WebP q85, ≤ 1600 px wide) |
| `ingest-artifacts` (private, no user policies) | worker only (service role) | `{userId}/{documentId}/{runId}/doc.json` | the parsed DoclingDocument, so later steps and retries never re-parse |

- `doc.json` lives in its own bucket because the `documents` bucket only accepts PDFs and images,
  and people should never read or write intermediate files. P3.1 creates the bucket.
- Every path starts with the user id, so deleting a document is deleting one prefix per bucket.
- People download originals through a signed URL valid for 60 s with the original filename.

## 9. The worker function

`ingest-document`, triggered by `document/uploaded`. Concurrency: 2 runs per worker deployment
(global key) and 2 per person (`event.data.user_id`). Retries: 3 with backoff. Cancelled by
`document/reprocess` and `document/deleted` for the same document, and `notebook/deleted` for its
notebook (section 11).

Every step starts with the **current-run guard**: load the document; if it's deleted or its
`ingest_run_id` isn't this run's, stop quietly (no failure, no writes).

| Step | Does | Output (keyed by document + run) | Idempotent because | Retry |
| --- | --- | --- | --- | --- |
| validate | stream the source to a temp dir (size cap), check `%PDF-`, open with pypdfium2: encrypted, corrupt, 0 pages, too many pages; SHA-256; record parser and embedding versions | `page_count`, `file_size`, `sha256`, `parser_version`, `embedding_model` on the document | same values overwrite | download retried; validation errors are final |
| parse | per-page text check to find scanned pages; Docling conversion (tables, picture images, OCR only when needed); markdown export (size-capped) | `doc.json` in `ingest-artifacts`, `ocr_used`, `markdown` | skips when `doc.json` for this run exists | `parse_timeout` is final; unexpected errors retried |
| figures | pictures from `doc.json`: page, bbox, label, paper caption; skip tiny images and repeated logos; WebP to storage | `figures` rows by (document, run, ordinal); image files at deterministic paths | upsert by ordinal; storage upload with upsert | retried |
| captions | vision descriptions with `FAST_MODEL`, 4 at a time, cached by image hash | `figures.description` | skips figures that have one; cache by `image_sha256` | per-figure failure keeps the paper caption only; never fails the document |
| chunk | Docling HybridChunker on `doc.json` (≈ 400 tokens, embedding-model tokenizer) + one chunk per figure caption | in memory (deterministic from `doc.json`) | pure function of its input | retried |
| embed | batches of 96, backoff on 429/5xx, vector length checked, token cap per document; insert in batches of 100 | `chunks` rows upserted on (document, run, chunk_index) | embeds only chunks of this run that lack a vector | in-step backoff (5 tries) + step retries |
| finalize | `finalize_ingest(document_id, run_id)` | old runs' chunks/figures removed; `ready`, counts, `finished_at` | the function is a no-op returning false for a stale run and safe to repeat for the current one | retried |

On final failure (retries exhausted, or a final error): `set_document_stage(..., 'failed')` with the
mapped code and vars. Unexpected exceptions map to `internal` and are logged with `document_id`,
`run_id`, step and exception type.

**Parse progress (decided in P3.6).** Docling's `progress_callback` reports every finished page
(`completed_pages` of `total_pages`), so the whole PDF is converted in one pass and the detail line
counts real pages. Page-range batches were rejected: they break tables and reading order at batch
boundaries.

**OCR.** Pages with fewer than about 20 characters of extractable text and an image layer count as
scanned. No scanned pages: OCR off. Otherwise OCR runs and the stage shows `ocr` with the
scanned-page count. No text after OCR: `no_text_found`.

**OCR engine (decided in P3.7): RapidOCR on ONNX Runtime.** Its detection, classification and
recognition models are small ONNX files (baked into the image with `docling-tools models download`,
`HF_HUB_OFFLINE=1` at run time), it needs no system packages (unlike Tesseract) and is far lighter
than EasyOCR's torch models. At most two Docling converters exist per process (OCR on and off).

## 10. Chunks, positions and figures

- Chunk fields: `content`, contextualised text for embedding (title + heading path + text),
  `headings`, `page_start`, `page_end`, `bboxes`, `kind` (`text`, `table`, `figure_caption`),
  `token_count`, `figure_id` for caption chunks. Tables are stored as Markdown; equations keep LaTeX
  where Docling provides it. Empty and boilerplate chunks (page numbers, running headers) are
  dropped.
- **Positions:** `bboxes` is a list of `{page, l, t, r, b}`: page numbers start at 1, coordinates are
  PDF points (1/72 inch) with the origin at the **top-left** of the page. Docling reports PDF
  provenance with a bottom-left origin; the worker converts with the page height before writing.
  Phase 4 highlights scale these by the viewer's zoom.
- Figure caption chunks read `"{label} (page {p}): {paper caption}\n{description}"`, with
  `page_start = page_end = p` and `bboxes = [figure bbox]`.
- `hybrid_search()` only returns chunks of a document's **published run** (`ready_run_id`, set by
  `finalize_ingest()`), for documents and notebooks that aren't deleted, and returns the page
  fields, kind, bboxes, headings and figure id. Optional `p_document_ids` limits it to the sources
  a person has ticked ("Asking 2 of 3 sources").

## 11. Re-process, delete and cancel

| Action | What happens |
| --- | --- |
| Re-process ("Try again" or the card menu) | `POST /api/documents/[id]/reprocess`: new `ingest_run_id`, `attempt + 1`, stage `queued`; sends `document/reprocess` then `document/uploaded`, both carrying the new run id. Old chunks stay searchable until finalize swaps them. Max 3 per document per hour. |
| Delete a source | Soft delete (`deleted_at`): hidden and excluded from search at once; toast "Source deleted" with Undo (8 s). Sends `document/deleted`, which cancels a running ingest at once. A cleanup function sleeps 30 s, then, if the document is still deleted, removes its storage prefixes and its row (chunks and figures cascade). |
| Undo | Clears `deleted_at`. If the document was mid-ingest when deleted, Undo starts a new run (like a re-process), because the old run was cancelled. |
| Delete a notebook | Same pattern: `notebook/deleted` cancels runs of its documents; after 30 s, if still deleted, every document is cleaned up, then the notebook row. Undo restores the notebook and restarts interrupted runs. |
| Cancel an upload | Deletes the partial object and the row. Nothing was queued. |

**Cancellation matching.** `cancelOn` matches `document_id` (or `notebook_id`) **and** a different
`run_id`, so a re-process can never cancel the run it starts, whatever order the two events arrive
in. Even an uncancelled stale run can't write anything: the current-run guard and
`set_document_stage()` ignore it, and `finalize_ingest()` returns false.

**Sweepers (cron).** Every 30 min: uploads stuck in `uploading` for more than 2 h become `failed`
with `upload_interrupted`, and their partial files are removed. Daily: storage objects without a
live document row and older than 24 h are deleted; documents stuck in a non-terminal stage for more
than 2 h with no running queue run become `failed` with `internal` and are logged.

## 12. Events

Payload keys are snake_case. Event ids make sends idempotent (a double-clicked confirm starts one
run). **No event ever carries a password, a token or content.**

| Event (contract key) | Name | Payload | Event id | Sent by | Consumed by |
| --- | --- | --- | --- | --- | --- |
| `uploaded` | `document/uploaded` | `document_id`, `notebook_id`, `user_id`, `run_id` | `uploaded-{run_id}` | `/uploaded`, `/reprocess`, link/Drive/text creation (P3.6v2 may split per source type) | worker ingest functions |
| `reprocess` | `document/reprocess` | `document_id`, `notebook_id`, `user_id`, `run_id` (new) | `reprocess-{run_id}` | `/reprocess` | `cancelOn` of older runs |
| `deleted` | `document/deleted` | `document_id`, `notebook_id`, `user_id` | — | remove action | `cancelOn`; web cleanup function |
| `notebookDeleted` | `notebook/deleted` | `notebook_id`, `user_id` | — | notebook delete action | `cancelOn`; web cleanup function |
| `fastReady` | `document/fast-ready` | `document_id`, `notebook_id`, `user_id`, `run_id` | `fast-ready-{run_id}` | `finalize_fast_pass` caller | deep pass; notebook insights |
| `passwordProvided` | `document/password-provided` | `document_id`, `user_id`, `run_id` (the password stays in Redis) | — | `POST /api/documents/[id]/password` | the waiting run |
| `sourcesChanged` | `notebook/sources-changed` | `notebook_id`, `user_id` | — | add, remove, ready | `generate-notebook-insights` (debounced 20 s) |

### 12.1 Passwords

`POST /api/documents/[id]/password {password}` (requireUser, ownership, zod, rate limit): stores the
password in Redis under the document id with a 600 s TTL, counts attempts (5 per 15 min →
`password_attempts`), sends `document/password-provided`. The worker reads the key once, deletes it
at once, and opens the file in memory; a wrong password sets `password_wrong`. Never in the
database, logs, Inngest payloads, error messages or traces. Without Redis configured, the password
prompt is disabled and the source stays in Needs password with a clear line (P3.7v2).

## 13. Database (P3.1 owns the exact DDL)

- `documents`: `stage` (enum from the contract stages), `progress` 0–100, `stage_detail`,
  `error_code`, `error_vars`, `original_filename`, `storage_path`, `file_size`, `sha256`,
  `page_count`, `ocr_used`, `figure_count`, `chunk_count`, `ingest_run_id`, `attempt`,
  `parser_version`, `embedding_model`, `stage_timings` (stage → start time and duration),
  `started_at`, `finished_at`, `deleted_at`, `updated_at`. The old `status`, `error` and
  `file_path` columns go.
- **Two run ids.** `ingest_run_id` is the run being processed; `ready_run_id` is the run people
  search and read. `finalize_ingest(document, run, markdown, token_count)` sets `ready_run_id`,
  replaces the full text and deletes other runs' rows in one transaction, so a re-processed source
  keeps answering from its previous run until the new one is Ready (and keeps doing so if the
  re-process fails). `start_ingest_run(document)` begins a re-process: new run id, `attempt + 1`,
  `queued`.
- **What people may write.** A trigger sets `stage`, `ingest_run_id`, `storage_path`
  (`{userId}/{documentId}/source.pdf`) and the first timing on insert, whatever the client sends.
  Column grants let people insert only `id, notebook_id, user_id, title, original_filename,
  mime_type, file_size, sha256`, and update only `title` and `deleted_at`. Notebooks: people
  insert, edit and soft-delete; only the cleanup job hard-deletes. Everything else goes through
  the API (service role, after an ownership check) or the worker.
- Duplicate lookup: an index on `(notebook_id, sha256) where deleted_at is null`, **not unique**,
  because "Add anyway" must be able to add the same file again. The check ignores failed documents.
  The worker overwrites the browser's `sha256` with the one it computes.
- `chunks` and `figures` gain `ingest_run_id`; chunks are unique on
  `(document_id, ingest_run_id, chunk_index)`, figures on `(document_id, ingest_run_id, ordinal)`.
- `set_document_stage()` and `finalize_ingest()`: `security definer`, `search_path = ''`, executable
  by `service_role` only.
- `documents` joins the `supabase_realtime` publication; RLS on every new or changed table, extended
  in `tests/rls`.

## 14. Security, privacy and observability

- Every route and action: `requireUser`, ownership check, zod input, `withErrorHandling`. The
  service role key exists only in the worker and server code, never in the client bundle.
- The worker accepts queue calls only with a valid Inngest signature in production.
- Logs carry `document_id`, `run_id`, step, stage, durations, counts and error codes. Never document
  text, file contents, filenames, prompts or keys.
- `stage_timings` records when each stage started and how long it took; the source detail panel
  shows them. Caption token usage is logged per document.

## 15. Changing the contract

1. Edit `contracts/ingestion.json` (and this spec).
2. `cd apps/web && npm run contract:sync` (also runs before `npm run dev` and `npm run build`).
3. `npm test -- -u src/lib/ingestion` to rewrite `contracts/fixtures/ingestion-cases.json`, and
   review its diff.
4. `cd services/worker && python -m pytest -q`: the worker must give the same answers.
5. Stage or transition changes also need a migration (the `document_stage` enum and
   `set_document_stage()`). Breaking changes bump `version`.

Why a generated copy on the web side: Turbopack only resolves files inside `apps/web`, and pointing
its root at the repo would make it watch the worker's virtualenv. `contract.test.ts` fails when
the copy drifts. The worker reads the JSON directly; its image must include it at
`/app/contracts/ingestion.json` or set `INGESTION_CONTRACT_PATH` (P3.14 builds the image from the
repo root).

## 16. Acceptance criteria (Phase 3 v2)

1. From `/app`, adding a source creates the notebook and changes the URL without a reload.
2. Every origin works: files (all listed types), website, YouTube, Drive, copied text, web search.
3. PDF fixtures: owner-locked → Ready; password (correct) → Ready; wrong password → retry; repairable
   → Ready (`repaired` notice); renamed PNG → image source; scanned → OCR → Ready; 300+ pages →
   batched; over `MAX_PAGES` → first pages read with `pages_capped`; unrepairable → Couldn't read +
   fix.
4. Passwords never appear in the database, logs or event payloads (grep + payload inspection).
5. A 30-page text PDF reaches Ready to ask in ≤ 10 s; the deep pass swaps to Ready without breaking
   citations made in between.
6. Overview + 5 suggested questions appear after `fast_ready` and refresh when sources change.
7. SSRF tests pass (private IPs, redirects to private IPs, other schemes).
8. CSV, multi-sheet XLSX and nested JSON produce correct dataset schemas and dataset chunks.
9. Remove and delete confirm in dialogs with red actions; deleting a notebook with sources asks for
   its name.
10. 5 and 10 mixed sources at once all finish; web, worker, `test:rls` and CI are green with zero
    serious axe issues.

## 17. Open decisions

| Decision | Owner | Status |
| --- | --- | --- |
| Source quota is per notebook (20 on the free plan), not per account | product (you) | chosen; confirm |
| Parse progress: Docling page progress vs page-range batches | P3.6 | Docling page progress; v2 batches huge files by `FAST_PASS_PAGE_BATCH` (P3.7v2) |
| OCR engine | P3.7 | RapidOCR on ONNX Runtime (section 9) |
| Worker image build context includes `contracts/` | P3.14 | yes |
| Contract stage order: `parsing_deep` before `ocr` (database enum order) | S0 | decided (section 4, rule 7) |
| `empty_file` error added to the plan's v2 list (a 0-byte file isn't damaged) | S0 | decided |
| `documents` keeps its name vs rename to `sources` + compatibility view | P3.1v2 | open |
| Storage path for any type: `{userId}/{documentId}/source` (no extension) | P3.1v2 | open (contract path stays `source.pdf` until the trigger changes with it) |
| Fast-run citations after the deep swap: soft-retire vs map by page + overlap | P3.8v2 | open |
| YouTube transcripts: free library vs paid API | you | open |
| Web search provider (Tavily, Exa, Brave) | you | open |


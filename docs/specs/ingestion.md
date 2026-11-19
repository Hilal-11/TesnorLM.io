# Ingestion spec (Phase 3)

How a PDF becomes a **Ready** source: page-aware chunks, figures and captions in the database,
with honest live progress and errors that say what happened and how to fix it. Every later feature
(cited answers, marker highlights, lessons, quizzes) reads what this pipeline writes.

- **Contract:** [`contracts/ingestion.json`](../../contracts/ingestion.json) is the only place stage
  names, transitions, learner words, detail lines, error copy, events, limits and storage paths are
  defined. TypeScript: `apps/web/src/lib/ingestion/contract.ts`. Python:
  `services/worker/app/contract.py`. See [Changing the contract](#15-changing-the-contract).
- **UI rules:** `.claude/skills/tensorlm-design/SKILL.md` (sections 8.2, 8.4, 9, 10.1) overrides
  anything here about how things look or read.

## 1. Goals and non-goals

**Milestone.** A person creates a notebook, uploads up to 10 PDFs at once on a patchy connection,
watches each one move through honest live stages, and sees it Ready with page-aware chunks, figures
and captions in the database. Failures explain the reason and the fix. Five uploads at once all
finish.

Goals:

1. Reliable: no lost jobs, no duplicated chunks, no orphaned files, no zombie runs.
2. Honest: progress shows real counts ("Reading page 18 of 42"), never a fake percentage.
3. Citable: every chunk keeps its pages and positions (bounding boxes) for Phase 4 citations and
   marker highlights.
4. Safe: malicious, huge or broken PDFs fail cleanly and can't take the worker down.
5. Private: each person sees only their own documents; logs never contain document content.

Non-goals (Phase 3): DOCX, images, CSV or links as sources (the upload modal shows links as "Coming
soon"); per-plan limits (Phase 8: one free limit for now); answering questions (Phase 4);
collaboration or sharing; languages other than English for OCR by default (configurable).

## 2. Words used here

| Term | Meaning |
| --- | --- |
| Document | One uploaded file (`documents` row). Shown to people as a **source**. |
| Ingest run | One attempt to process a document, identified by `ingest_run_id` (uuid). A new upload or a re-process starts a new run. All worker output is keyed by `document_id` + `run_id`. |
| Stage | Where a run is in the stage machine (section 4). Stored in `documents.stage`. |
| Step | A unit of work in the queue function (validate, parse, …). Retried independently. |
| Current run | The run whose id is in `documents.ingest_run_id`. Output of any other run is stale. |

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
uploading ─▶ queued ─▶ validating ─▶ parsing ─┬─▶ ocr ─┬─▶ reading_figures ─▶ indexing ─▶ ready
                                              │        └──────────────────────▲
                                              ├─▶ reading_figures             │
                                              └───────────────────────────────┘
every stage except ready ─────────────────────────────────────────────────────────────▶ failed
```

| From | Allowed next stages |
| --- | --- |
| uploading | queued, failed |
| queued | validating, failed |
| validating | parsing, failed |
| parsing | ocr, reading_figures, indexing, failed |
| ocr | reading_figures, indexing, failed |
| reading_figures | indexing, failed |
| indexing | ready, failed |
| ready | — (terminal) |
| failed | — (terminal) |

Rules:

1. **Transitions apply within one run.** A new upload starts its run at `uploading`; a re-process
   starts a new run at `queued`. Starting a run is done by the API (it sets the new
   `ingest_run_id`), never by `set_document_stage()`.
2. **Same stage = progress update.** Reporting the current stage again only updates progress and
   detail. Progress never goes backwards within a run (the database and the UI both ignore it).
3. **Stale runs are ignored.** `set_document_stage()` does nothing when `p_run_id` isn't the current
   run, and when the move isn't in the table above (no backwards moves, no leaving a terminal stage).
   The SQL function mirrors this table; a test in P3.1 checks it against the contract.
4. **OCR is a stage, not a step.** It happens inside the parse step and is shown only when scanned
   pages are being read. Documents with no figures go straight from parsing (or OCR) to indexing.

## 5. Stages in the interface

People see one of six learner words (design skill 8.2) and a detail line with real counts. Detail
lines come from the contract's `details` templates; when a count is missing the fallback is shown.

| Stage | Word | Detail line (template) | Fallback | DB progress band |
| --- | --- | --- | --- | --- |
| uploading | Uploading | Uploading · {percent}% | Uploading | 0 (bytes progress is local to the uploading browser) |
| queued | Queued | Waiting to start | — | 0 |
| validating | Reading | Checking the file | — | 0–5 |
| parsing | Reading | Reading page {page} of {pages} | Reading the pages | 5–45 by pages |
| ocr | Reading | Running OCR on page {page} of {pages} ({pages} = scanned pages) | Running OCR | 5–45 (shares the parsing band) |
| reading_figures | Reading | Reading figures · {done} of {total} | Reading figures | 45–65 by figures |
| indexing | Indexing | Indexing {passages} passages | Indexing passages | 65–99 by passages written |
| ready | Ready | {pages} pages · Ready | Ready | 100 |
| failed | Failed | (the error's message and fix, section 6) | — | unchanged |

Templates support `{name}` and a count-based word, `{pages:page|pages}` ("1 page · Ready"). Values
are strings or whole numbers; anything else counts as missing, so the fallback shows. Producers
format decimals themselves (`sizeMb: "63.4"`).

The worker writes the rendered line into `documents.stage_detail` (≤ 1 write per second per
document; stage changes are written at once). The browser renders `uploading` lines itself.

## 6. Errors

Every failure has a code from the contract. The interface shows the **message** (what happened),
the **fix** (what to do) and, where there is one, an **action** button. Never "Something went
wrong". `autoRetry` says whether the queue retries the step by itself.

| Code | Message | Fix | Action | Raised by | Auto-retry |
| --- | --- | --- | --- | --- | --- |
| not_pdf | This file isn't a PDF. | Choose a PDF file instead. | — | browser, API, worker (magic bytes) | no |
| file_too_large | This file is {sizeMb} MB. The limit is {limitMb} MB. | Split the PDF or upload chapters separately. | — | browser, API, worker | no |
| too_many_pages | This PDF has {pages} pages. The limit is {limit} pages. | Upload chapters separately. | — | browser (optional), worker | no |
| encrypted_pdf | This PDF is password-protected. | Remove the password and upload it again. | — | browser (optional), worker | no |
| corrupt_pdf | This PDF looks damaged and can't be opened. | Re-download or re-export the PDF, then try again. | — | worker | no |
| no_text_found | We couldn't find readable text, even with OCR. | Upload a clearer scan. | — | worker | no |
| parse_timeout | This PDF took too long to read. | Try again, or upload it in smaller parts. | Try again | worker | no |
| quota_exceeded | This notebook has reached its limit of {limit} sources. | Remove a source, then add this one. | — | API | no |
| duplicate_file | This paper is already in this notebook. | Open the copy you added, or add it again anyway. | Open it · Add anyway | API | no |
| upload_interrupted | The upload stopped. | Check your connection, then resume the upload. | Resume upload | browser, stale-upload sweeper | no |
| internal | We couldn't finish reading this file. | Try again in a moment. | Try again | anything unexpected (logged) | yes |

- The skill's example reads as message + fix: "This file is 120 MB. The limit is 50 MB. Split the
  PDF or upload chapters separately." (a test asserts it).
- Values for an error are stored in `documents.error_vars` (jsonb) next to `error_code`, so the
  copy can change without touching stored rows.
- Unknown codes render as `internal`. Raw exception text never reaches people or the database.
- "Try again" on a failed source is a re-process (section 11).

## 7. Limits

Defaults live in the contract's `limits`; environment variables override them where listed. The
server and worker enforce them; the browser only gives early feedback.

| Limit | Default | Env | Browser | API | Worker |
| --- | --- | --- | --- | --- | --- |
| File size | 50 MB | `MAX_UPLOAD_MB` | instant check | declared size, then the stored object's size | downloaded bytes |
| Pages | 200 | `MAX_PAGES` | optional pdf.js check | — | authoritative |
| Files per drop | 10 | — | yes | — | — |
| Parallel uploads per browser | 3 | — | yes (the rest wait as Queued locally) | — | — |
| Sources per notebook (free) | 20 | `MAX_SOURCES_FREE` | — | yes | — |
| Parse time (incl. OCR) | 10 min | `PARSE_TIMEOUT_S` | — | — | yes → `parse_timeout` |
| Figures per document | 40 (largest by area) | — | — | — | yes (skipped count logged) |

The source quota counts a notebook's documents that are not deleted and not failed.

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

**Parse progress.** P3.6 decides between Docling page-level progress and converting in page ranges
(for example 20 pages per batch), choosing honest progress without hurting quality, and records the
choice here.

**OCR.** Pages with fewer than about 20 characters of extractable text and an image layer count as
scanned. No scanned pages: OCR off. Otherwise OCR runs (engine chosen in P3.7, models baked into
the image) and the stage shows `ocr` with the scanned-page count. No text after OCR:
`no_text_found`.

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
run).

| Event (contract key) | Name | Payload | Event id | Sent by | Consumed by |
| --- | --- | --- | --- | --- | --- |
| `uploaded` | `document/uploaded` | `document_id`, `notebook_id`, `user_id`, `run_id` | `uploaded-{run_id}` | `/uploaded`, `/reprocess`, Undo of an interrupted run | worker `ingest-document` |
| `reprocess` | `document/reprocess` | `document_id`, `notebook_id`, `user_id`, `run_id` (new) | `reprocess-{run_id}` | `/reprocess` | `cancelOn` of older runs |
| `deleted` | `document/deleted` | `document_id`, `notebook_id`, `user_id` | — | delete action | `cancelOn`; web cleanup function |
| `notebookDeleted` | `notebook/deleted` | `notebook_id`, `user_id` | — | notebook delete action | `cancelOn`; web cleanup function |

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

## 16. Acceptance criteria (Phase 3)

1. A signed-in person creates a notebook and drops 10 PDFs at once; at most 3 upload in parallel,
   each with real byte progress; all reach Ready.
2. Turning the network off mid-upload and back on resumes the upload ("Waiting for connection…").
3. A source card moves Uploading → Reading → Indexing → Ready live, without a reload, including
   after a Realtime reconnect (polling fallback).
4. A scanned PDF shows "Running OCR on page i of n" and becomes Ready with searchable text.
5. Encrypted, corrupt, non-PDF, oversized and too-long files fail with the contract's message and
   fix; nothing crashes; nothing is retried that can't succeed.
6. Every chunk of a Ready document has `page_start`/`page_end` within `1..page_count` and bboxes;
   tables are `table` chunks; each stored figure has a caption chunk with `figure_id`.
7. Re-processing while a run is active leaves only the new run's chunks; search never sees a
   half-indexed document.
8. Deleting a source hides it from search at once; Undo restores it; otherwise, after the cleanup
   job, its storage prefixes are empty and its rows are gone.
9. A load test with 5, then 10, concurrent uploads finishes every document, none lost.
10. Web (lint, typecheck, test, build, e2e), worker (pytest) and `test:rls` pass, with zero serious
    axe issues on Phase 3 screens.

## 17. Open decisions

| Decision | Owner | Status |
| --- | --- | --- |
| Source quota is per notebook (20 on the free plan), not per account | product (you) | chosen here; confirm |
| Parse progress: Docling page progress vs page-range batches | P3.6 | open |
| OCR engine (EasyOCR, Tesseract or RapidOCR) | P3.7 | open |
| Worker image build context includes `contracts/` | P3.14 | open |

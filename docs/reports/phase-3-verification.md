# Phase 3 verification — Notebooks & ingestion

Audited 2026-11-20 on branch `phase-3`. Evidence was gathered on the **local Supabase stack**
(`npx supabase start`, never the main project), the **Inngest Dev Server 1.53.0**, the worker
(`WORKER_FAKE_AI=1`: fake embeddings, no captions, no API cost) and the web app. No `.env.test`
test project exists yet, so everything that the checklist wants on "TEST" ran on the local stack
instead (same migrations, isolated, disposable).

## Summary

| Status | Count |
| --- | --- |
| PASS | 127 |
| PARTIAL | 14 |
| FAIL | 2 |
| BLOCKED | 4 |
| **Total** | **147** |

**Phase 3 milestone met: yes, locally.** All twelve milestone items (G1, G2, G6, I2, J2, K2, L2,
M6, N1, O8, S5, C1) pass on the local stack with the real queue and worker. Production
verification (S6, S7) and the TEST-project run of C1 wait on accounts and deploys only you can do
(see "Needs Hilal").

Bugs found and fixed during this audit (each with a regression test): PDFium and parallel Docling
conversions crashed the worker under load (now serialized behind one native lock); pdf.js's own
worker messages were mistaken for the pre-check result ("This file isn't a PDF" for every PDF);
React StrictMode reused a Realtime channel name; long status details pushed the word out of the
source card; truncated file names were read aloud by screen readers; session reads ran during
prerender (`Date.now()` warnings); cancel waited on a stalled request; a stale `.next` caused a
dev reload loop; the production build hung on the bundled Web Worker (the pre-check worker is now a
static file in `public/workers`).

## Results

| ID | Item | Status | Evidence |
| --- | --- | --- | --- |
| A1 | Ingestion spec | PASS | `docs/specs/ingestion.md` §1–17: flow, stage machine, transitions, UI words, errors (message + fix), limits, storage, events, idempotency, cancellation, retries, acceptance; open decisions resolved in §17 |
| A2 | Shared contract | PASS | `contracts/ingestion.json`: stages, transitions, uiWords, details, actions, errors, events, limits, storage |
| A3 | TS + Python loaders | PASS | `src/lib/ingestion/contract.ts`, `services/worker/app/contract.py`; vitest `contract.test.ts`, pytest `tests/test_contract.py` (part of 426 passed) |
| A4 | Cross-language parity | PASS | vitest writes `contracts/fixtures/ingestion-cases.json`; `tests/test_contract.py` asserts identical words, transitions, copy |
| A5 | No hard-coded stages/codes | PASS | Worker uses `STAGE.x` / `ERROR.x` (`app/contract.py`); `tests/test_contract_names.py` checks every name exists and no literals remain; web compares only typed `Stage`/`ErrorCode` literals the compiler checks against the contract; grep of untyped literals in `src` is empty |
| B1 | Migrations applied, types in sync | BLOCKED | Applied to the local stack (all DB tests); `npm run db:types:local` → no diff. Not yet applied to the TEST or main project (needs your Supabase login) |
| B2 | notebooks columns | PASS | `supabase/migrations/0004_notebooks_ingestion.sql:13-30` (status enum, color token check, position "C" collation, exam_date, last_opened_at, deleted_at, updated_at) |
| B3 | documents columns | PASS | `0004…sql:78-104` (+ `ready_run_id`, `reprocessed_at`) |
| B4 | Unique duplicate index | PARTIAL | `documents_duplicate_idx (notebook_id, sha256) where deleted_at is null` exists but is **not unique on purpose** (spec §13: "Add anyway" adds the same file again); duplicates are blocked in the API instead (`tests/rls/documents-api.test.ts` "duplicates are refused unless forced"). Needs your confirmation |
| B5 | chunks columns + unique key | PASS | `0004…sql:192-212`, `chunks_run_index_key` |
| B6 | figures columns | PASS | `0004…sql:160-186`, `figures_run_ordinal_key` |
| B7 | finalize_ingest atomic, stale → false | PASS | `tests/rls/ingestion.test.ts:219` "swaps the new run in atomically and refuses stale runs" |
| B8 | set_document_stage ignores stale/backward | PASS | `tests/rls/ingestion.test.ts:165,193` (contract transitions, stale runs, backward moves, 'ready') |
| B9 | Functions not callable by people | PASS | `tests/rls/ingestion.test.ts:144` every pipeline function refused for a signed-in person and a visitor |
| B10 | hybrid_search current run only, page fields | PASS | `tests/rls/ingestion.test.ts:275`; worker `tests/test_supabase_store.py::test_full_ingest_into_postgres` (search after a real ingest) |
| B11 | documents in Realtime | PASS | `tests/rls/ingestion.test.ts:347,351` (publication + owner-only delivery) |
| B12 | Storage bucket limits + folder policy | PASS | `0004…sql:540-556`; `tests/rls/ingestion.test.ts:399-423` |
| B13 | Old status column gone | PASS | dropped in `0004…sql:117-121`; grep for `documents.status`/`file_path` in `src` is empty |
| C1 | test:rls passes, covers Phase 3 | PASS | `npm run test:rls:local` → 5 files, 91 tests passed + `documents-api.test.ts` 8 passed; `rls_status()` coverage check includes every table. (TEST-project run is in "Needs Hilal") |
| C2 | Person B gets 404/0 rows | PASS | `tests/rls/documents-api.test.ts` (create in A's notebook, read, confirm, cancel, re-process, delete, restore, download → 404; A's row and file untouched); notebooks/chunks/figures/storage in `tests/rls/rls.test.ts`, `notebooks.test.ts`, `ingestion.test.ts` |
| C3 | Routes: requireUser + ownership + zod + withErrorHandling | PASS | `api/notebooks/route.ts:6`, `api/notebooks/[id]/documents/route.ts:11,29`, `api/documents/[id]/route.ts:7`, `…/uploaded/route.ts:9`, `…/cancel/route.ts:9`, `…/reprocess/route.ts:9`, `…/restore/route.ts:9`, `…/download/route.ts:9` — all `withErrorHandling` + `requireUserForApi`, `idParam` (zod uuid), body via `createDocumentSchema`; ownership via RLS in `lib/documents/server.ts:getSource` |
| C4 | Worker rejects unsigned requests in production | PASS | `tests/test_queue.py::test_unsigned_requests_are_rejected_in_production`; `app/main.py` refuses unsigned sync unless INNGEST_DEV |
| C5 | Old POST /ingest removed | PASS | `tests/test_queue.py::test_old_ingest_route_is_gone`; `WORKER_URL`/`WORKER_SECRET` removed |
| C6 | No secrets in client bundle | PASS | `npm run build`, then grep `.next/static` for `SERVICE_ROLE`, `INNGEST_SIGNING_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` → 0 files |
| C7 | Logs carry no document content | PASS | redaction by key in `src/lib/logger.ts` and `services/worker/app/log.py` (content, text, title, filename, prompt, caption…); worker logs during e2e/load runs contain ids, steps, durations, counts and codes only |
| C8 | Storage paths from the server | PASS | insert trigger `documents_before_insert` (`0004…sql:132-148`) + `sourcePath()` from the contract (`lib/documents/server.ts:32`); `tests/rls/ingestion.test.ts:92` ignores client paths; `documents-api.test.ts` asserts `{user}/{doc}/source.pdf` |
| C9 | Worker container non-root | PASS | `docker exec … whoami` → `worker` (uid 10001) |
| D1 | Notebook actions with zod | PASS | `src/app/(app)/app/notebooks/actions.ts` (create, update, move, touch, delete, restore via `defineAction`) |
| D2 | Fractional ordering | PASS | `src/lib/notebooks/shared.test.ts` incl. 50 random moves; `tests/rls/notebooks.test.ts` ordering |
| D3 | Soft delete / restore | PASS | `tests/rls/notebooks.test.ts`; e2e `notebooks.spec.ts` delete → Undo |
| D4 | Hard delete after Undo window | PASS | `src/inngest/functions.ts` (`cleanup-notebook`, `cleanup-document`, 30 s); `tests/rls/notebooks.test.ts` "hard delete empties both buckets"; queue log: `document cleanup … status: deleted, files: 7` |
| D5 | Stale update → conflict | PASS | `tests/rls/notebooks.test.ts` "conflict returns the fresh row" |
| E1 | Notebooks page header/controls | PASS | `notebooks-view.tsx`; Ctrl/⌘ N in `app-shell.tsx` (some browsers reserve it); e2e view switch in URL + remembered |
| E2 | Responsive grid 1/2/3/4 | PASS | `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 min-[1440px]:grid-cols-4`; screenshots `docs/screenshots/phase3/notebooks-grid-*` |
| E3 | Card content | PASS | `notebook-card.tsx`; e2e asserts "No sources yet · Exam 12 Dec", status word |
| E4 | List view DataTable + bulk | PASS | `notebooks-table.tsx` (sorting, selection, Move to…, Delete with Undo) |
| E5 | Create/edit dialog | PASS | `notebook-dialog.tsx` (name, description, subject combobox, 5 named swatches, exam date); e2e |
| E6 | Inline rename | PASS | e2e Enter saves (survives reload), Esc cancels |
| E7 | Delete toast with Undo, no confirm | PASS | e2e "Notebook deleted" → Undo |
| E8 | Empty states | PASS | first-notebook (graph paper) and no-results, one action each; e2e |
| E9 | Skeleton after 300 ms; Try again | PASS | `DelayedSkeleton` in `notebooks/page.tsx`; `notebooks-error.tsx` |
| E10 | Sidebar recent notebooks | PASS | `app-shell.tsx`; e2e checks the "Recent notebooks" nav |
| E11 | Onboarding sample paper | BLOCKED | Step 4 now creates the first notebook and loads `/samples/sample-paper.pdf` through the normal upload flow (`onboarding/actions.ts`, `notebook-workspace.tsx`); the licensed sample file and `docs/samples.md` don't exist yet |
| F1 | Board columns | PASS | `notebooks-board.tsx`; e2e headings + counts |
| F2 | Mouse, touch, keyboard drag + announcements | PARTIAL | mouse and keyboard (Space/arrows/Space, Esc) proven in `e2e/board.spec.ts` with announcements; touch sensor configured (250 ms long press) but not automated |
| F3 | Lift without tilt, dashed placeholder, highlight | PASS | `board.spec.ts` asserts no rotation in the overlay transform and `data-highlighted` on the target |
| F4 | Optimistic move, rollback | PASS | `board.spec.ts` persists after reload; failed move rolls back with an error toast |
| F5 | Counts, empty columns | PASS | `board.spec.ts` |
| F6 | Mobile behaviour documented | PASS | columns stack < 768 px (reason in `notebooks-board.tsx` and progress log); `board.spec.ts` mobile test |
| F7 | Reduced motion | PASS | `board.spec.ts` reduced-motion test (no transitions, no drop animation) |
| G1 | Create checks ownership, size, .pdf, quota, duplicate | PASS | `tests/rls/documents-api.test.ts` (404 for others' notebooks, `not_pdf`, `file_too_large`, `quota_exceeded`, 409 `duplicate_file` with `existingId`, `force`) |
| G2 | Confirm verifies object and size, queues, sends event | PASS | `documents-api.test.ts` (size mismatch → `upload_interrupted`, match → `queued`); e2e upload → Ready |
| G3 | Cancel removes object and row | PASS | e2e `sources.spec.ts` "cancel during upload…" |
| G4 | Browser pre-checks with contract copy | PASS | `src/lib/uploads/manager.test.ts`; e2e "bad files fail at once…" (not a PDF, password-protected, 201 pages) |
| G5 | SHA-256 in a Web Worker | PASS | `src/lib/uploads/precheck.worker.ts`; browser probe showed the worker chunk and pdf.js loading off the main thread |
| G6 | TUS, byte progress, 3 parallel | PASS | `src/lib/uploads/browser.ts` (tus-js-client, 6 MB chunks); `manager.test.ts` "uploads at most 3 at a time", "reports real byte progress" |
| G7 | Network drop resumes (route abort) | PASS | e2e "a dropped connection shows Waiting for connection… and resumes" |
| G8 | beforeunload warning | PARTIAL | `src/lib/uploads/browser.ts` (`busy()` check); no automated test |
| H1 | Modal from Add source, Ctrl/⌘ U, onboarding | PARTIAL | e2e Add source + Ctrl+U; onboarding path wired but needs the sample file (E11) |
| H2 | Dropzone | PASS | `upload-dialog.tsx` (dashed border, action colour + `drop-wash` when dragging, Browse files, limits helper); screenshot `upload-dialog-*` |
| H3 | Paste a link disabled, Coming soon | PASS | `upload-dialog.tsx`; screenshot |
| H4 | File rows | PASS | `UploadRow` (icon, middle-truncated name with full name for screen readers, size, progress + word + %, cancel/remove, reason + fix + actions) |
| H5 | Closing keeps uploads running | PASS | e2e clicks Done, upload continues to Ready |
| H6 | Full-window drop zone | PARTIAL | `window-drop.tsx` (220 ms fade, wash, "Drop to add to this notebook"); not automated |
| H7 | Paste a PDF | PARTIAL | `notebook-workspace.tsx` paste handler; not automated |
| H8 | aria-valuenow + aria-live | PASS | Radix Progress sets `aria-valuenow`; e2e asserts the live region ("paper_basic.pdf cancelled") |
| I1 | Web functions | PASS | `src/inngest/functions.ts`, `src/app/api/inngest/route.ts`; synced to the Dev Server |
| I2 | Worker ingest-document | PASS | `services/worker/app/queue.py`; e2e and load test ran through it |
| I3 | Concurrency 2 + 2 per user | PASS | `tests/test_queue.py::test_concurrency_is_two_per_deployment_and_two_per_person` |
| I4 | Retries 3, step per stage | PASS | `test_retries_and_idempotency`; steps validate, parse, figures, captions, index, finalize (`app/pipeline.py`) |
| I5 | cancelOn reprocess/deleted | PARTIAL | cancel expressions proven (`test_cancel_rules_match_document_and_run`); a stale run writes nothing (`test_a_reprocess_mid_run_stops_the_old_run_without_writes`); live cancellation of a running run not demonstrated end to end |
| I6 | Final failure → mapped code | PASS | `test_final_failure_marks_the_document_internal`; seen in the first load test (`internal` after retries) |
| I7 | README run locally | PASS | `README.md` §5 (Dev Server, worker, web; fully local variant) |
| J1 | Magic bytes → not_pdf | PASS | `tests/test_validate.py` |
| J2 | Encrypted/corrupt/too many/0 pages | PASS | `tests/test_validate.py` (encrypted, corrupt, 201 pages, 0 pages); e2e corrupt PDF fails in the worker with the fix |
| J3 | Saved document facts | PASS | `test_paper_basic_becomes_ready` (page_count, parser_version, embedding_model); stack test |
| J4 | Throttle ≤ 1/s | PASS | `tests/test_progress.py::test_progress_updates_are_throttled_to_one_per_second_but_stage_changes_are_immediate` |
| J5 | Progress never backwards, bands | PASS | `test_progress_never_goes_backwards`, `test_bands_match_the_spec`, `test_stage_order_matches_the_contract` |
| J6 | Honest detail lines | PASS | `test_detail_lines_are_honest_counts`, `test_detail_lines_were_honest` |
| J7 | parse_timeout; internal logged with run_id | PASS | `test_parse_timeout_is_final`; `fail_internal` logs `document_id`, `run_id`, reason |
| J8 | Idempotent steps | PASS | `test_every_step_is_idempotent` (no re-parse, no re-embed, no duplicate rows) |
| J9 | doc.json saved | PASS | `test_parsed_document_is_saved_for_retries` |
| J10 | Temp cleanup, one converter | PASS | `tempfile.TemporaryDirectory` in every step; at most two cached converters, one conversion at a time (`app/parse.py`) |
| K1 | Born-digital: no OCR | PASS | `test_born_digital_pdf_does_not_use_ocr` |
| K2 | Scanned: OCR stage, text found | PASS | `test_scanned_pdf_runs_ocr_and_is_searchable` ("Running OCR on page 1 of 1", known word in a chunk, `ocr_used`) |
| K3 | Blank scan → no_text_found | PASS | `test_blank_scan_fails_with_no_text_found` |
| K4 | OCR models baked in | PASS | `services/worker/Dockerfile` (`docling-tools models download … rapidocr`, `HF_HUB_OFFLINE=1`); container parsed + OCR'd offline |
| L1 | HybridChunker, matching tokenizer, ~400 | PASS | `app/chunking.py` (cl100k_base, 400); `test_tokenizer_matches_the_embedding_model` |
| L2 | Pages, headings, bboxes, tokens | PASS | `test_paper_basic_chunks_are_page_aware`; Postgres `test_full_ingest_into_postgres` |
| L3 | Tables as table chunks; LaTeX equations | PARTIAL | tables → `kind=table` (Markdown) proven; equations stay as extracted text (Docling formula enrichment is off: slow and heavy) |
| L4 | Headers/footers filtered | PASS | `test_running_headers_and_page_numbers_are_filtered` |
| L5 | Contextual embedding text | PASS | `test_embedding_text_is_contextual` |
| L6 | Batching, backoff, 1536, cost cap | PASS | `tests/test_units.py` embedding tests; `check_token_budget` |
| L7 | Upserts on (doc, run, index) | PASS | `SupabaseStore.upsert_chunks` (`on_conflict`); idempotency test |
| L8 | bbox convention documented | PASS | spec §10 (PDF points, top-left origin, pages from 1) |
| M1 | Figures with page, bbox, label, caption | PASS | `test_figures_are_stored_with_positions_and_captions` |
| M2 | Tiny/logo skip, max 40 | PASS | `test_repeated_logos_are_skipped`, `test_tiny_images_and_repeated_logos_are_skipped`, `test_only_the_largest_figures_are_kept_in_reading_order` |
| M3 | WebP ≤ 1600 at the contract path | PASS | `test_webp_is_at_most_1600_wide`; path asserted in the pipeline test |
| M4 | Captions with FAST_MODEL, concurrency 4, retries, cache | PARTIAL | `app/captions.py` + `app/prompts/captioner.md`; unit tests with a fake client (model, effort low, image, retries, refusal, cache, concurrency); not yet run against the live Anthropic API |
| M5 | Failed caption keeps figure | PASS | `test_a_failed_caption_keeps_the_figure` |
| M6 | One searchable caption chunk per figure | PASS | `test_paper_basic_chunks_are_page_aware` (2 figure_caption chunks with figure_id); search hits in the stack test |
| M7 | Caption token usage logged | PASS | `step_captions` logs `caption usage` with input/output tokens per document |
| N1 | Ready only via finalize_ingest | PASS | `set_document_stage` refuses `ready` (`ingestion.test.ts:193`); grep: no other writer sets `ready` |
| N2 | Re-process: new run, old searchable until swap | PASS | `ingestion.test.ts` search during re-process; e2e "Read again" → Ready |
| N3 | 3 re-processes per hour | PASS | `documents-api.test.ts` "re-process is limited to 3 an hour" |
| N4 | Delete: hidden, out of search, Undo, cleanup | PASS | e2e delete → Undo → delete; cleanup job removed the row and all 7 files |
| N5 | Notebook delete cascades | PASS | `tests/rls/notebooks.test.ts` hard delete empties both buckets |
| N6 | Stale-upload sweeper | PASS | `tests/rls/sweepers.test.ts` "fails uploads stuck for 2 h…" |
| N7 | Orphan sweeper | PASS | `sweepers.test.ts` "removes folders with no document row after 24 h…" |
| N8 | Signed download, 60 s, filename | PASS | `documents-api.test.ts` (`expiresIn` 60, `download=paper.pdf`) |
| O1 | Sources panel 272 px, cards, empty state | PASS | `notebook-workspace.tsx` (`lg:grid-cols-[272px_…]`), `sources-panel.tsx`; screenshots |
| O2 | Status lines match the contract | PASS | `src/lib/documents/live.test.ts` "uses contract words and honest detail lines" |
| O3 | Ready check 1.5 s; failed reason + fix button | PASS | StatusPill Ready emphasis; `FailedActions` (Try again / Resume upload); screenshots |
| O4 | Selected edge; timeline with durations | PASS | `data-selected:border-l-2 border-l-primary`; e2e asserts the timeline and durations |
| O5 | Filtered subscription; stale ignored; no backwards | PASS | `use-live-sources.ts` (filter `notebook_id=eq.…`); `live.test.ts` merge rules |
| O6 | Reconnect with backoff + 5 s polling | PARTIAL | implemented in `use-live-sources.ts` ("Reconnecting…" line); not exercised by a test |
| O7 | Background tab title | PASS | `live.test.ts` "background tab title counts busy sources"; `notebook-workspace.tsx` |
| O8 | E2E upload → Ready live | PASS | `e2e/sources.spec.ts` records uploading → reading → indexing → ready in order with no reload |
| P1 | Tokens only | PASS | grep of Phase 3 UI for raw hex/rgba/purple/violet: none |
| P2 | Fonts (Hanken Grotesk / Literata / JetBrains Mono) | FAIL | the app loads **Inter** + JetBrains Mono (`src/app/layout.tsx`, from the monochrome redesign in commit 72e12ca, before Phase 3). Inter is on the skill's anti-slop list. Needs your decision |
| P3 | Sentence case, no banned words | PASS | grep for banned words/ALL CAPS in Phase 3 UI and the contract: none (contract test also asserts it) |
| P4 | Errors: reason + fix; one action per empty state | PASS | every error from the contract has message + fix (contract validation); empty states have one action |
| P5 | Micro-interactions | PASS | `interactive` hover/press/focus on new buttons, cards (`hover:border-rule-strong`, focus ring via `has-[…:focus-visible]`), menus |
| P6 | Only the drop wash; graph paper only on empty notebooks | PASS | `drop-wash` utility used only by the drop zones; graph paper only on the first-notebook empty state |
| P7 | Screenshots 1440/1024/390 light + dark, reviewed | PASS | `docs/screenshots/phase3/` 48 images (`SHOTS=1 … e2e/phase3-shots.spec.ts`); review found and fixed the status-line overflow and the empty key hint |
| Q1 | axe: zero serious/critical | PASS | `notebooks.spec.ts` (grid, list, board, dialog; light/dark; 1440/390), `board.spec.ts` mobile, `sources.spec.ts` (sources, upload dialog with errors; light/dark; 1440/390) |
| Q2 | Keyboard-only flows | PARTIAL | proven: create notebook, move a board card, open Add sources (Enter, Ctrl+U), Esc returns focus; not automated: Browse files, source menu → Read again, Delete + Undo by keyboard |
| Q3 | Focus visible; Esc closes and returns focus | PASS | e2e "Esc closes it and focus returns"; focus rings on cards and buttons |
| Q4 | Reduced motion | PASS | board reduced-motion test; `motion-reduce:` on drop zones, cards, columns |
| Q5 | No overflow at 320 px; 44 px targets | PARTIAL | no overflow at 390 px on notebooks, board and sources (e2e); 320 px and touch-target sizes not checked for Phase 3 pages |
| R1 | Fixture generator | PASS | `services/worker/tests/fixtures/make_fixtures.py` (paper_basic, scanned, blank_scan, encrypted, corrupt, not_pdf, too_many_pages, logo_repeat — all synthetic) |
| R2 | Pipeline test on paper_basic | PASS | `tests/test_pipeline.py` (chunks, headings, pages, bboxes, table, 2 caption chunks, ready, stage order) |
| R3 | Worker coverage ≥ 85% | PASS | `pytest --cov=app`: app 90%, `app/pipeline.py` 95% (`store.py` is covered by the local-stack test) |
| R4 | Web lint, typecheck, test, build, e2e | PARTIAL | lint 0 problems, typecheck clean, 261 unit tests, `npm run build` passes, Prettier clean. e2e on the local stack: notebooks 7/7, board 5/5, sources 12/12 when run per file; a combined run flaked with < 1 GB free RAM (dev-server timeouts). Signed-out `npm run e2e` not re-run this session |
| R5 | Worker pytest | PASS | full run 413 passed earlier; after the final fixes `pytest -m "not docling"` 426 passed, Docling regression tests passed; 3 stack tests pass with the local stack |
| R6 | CI green incl. Docling and a11y jobs | FAIL | there is no CI workflow yet (Phase 0 P3 never done) |
| S1 | Dockerfile | PASS | multi-stage, pinned, CPU torch, models baked, non-root, HEALTHCHECK; built and smoke-tested (4.67 GB) |
| S2 | /health and /ready | PASS | `tests/test_queue.py::test_health`, `test_ready_reports_models_and_storage`; container: `/ready` 503 until storage reachable |
| S3 | Structured JSON logs | PASS | `app/log.py`; step logs carry `document_id`, `run_id`, `step`, `duration_ms`, counts |
| S4 | stage_timings filled | PASS | `test_full_ingest_into_postgres` asserts a duration for every stage |
| S5 | Load test 5+scanned+failing, then 10 | PASS | `apps/web/scripts/load-test.mjs`: round 1 → 6 Ready + 1 `corrupt_pdf`, lost 0, wall 159 s; round 2 → 10 Ready, lost 0, wall 201 s. p50/p95: queued 72/109 s, validating 7/17 s, parsing 13/30 s, OCR 41 s, figures 1/2 s, indexing 0.4/0.5 s (round 1); round 2 queued 72/177 s, parsing 12/61 s |
| S6 | Railway worker, Inngest sync, Vercel keys | BLOCKED | needs your accounts |
| S7 | Production-like end to end | BLOCKED | needs S6; the same flow passes locally (O8, N4) |
| S8 | Cost note | PASS | `docs/progress.md` "Cost note": ≈ $0.004 per 20-page paper (estimate) |
| T1 | Backlog ticked + progress entries | PARTIAL | P3.0–P3.13 ticked with entries; P3.14 stays open until deploy (S6/S7) |
| T2 | One commit per task | PASS | see commit list below |
| T3 | README updated | PASS | `README.md` (architecture, run locally, variables, checks, deploy) |

### Phase 3 commits

```
b860e84 fix(sources): readable status lines, full names, onboarding first source
91abc1f test(ingestion): load test and cross-person API checks
a9f1afd fix(worker): serialize native PDF work; name stages via the contract
8296e4c chore(web): format landing page
d662c8a feat(sources): re-process, delete with Undo, download
008ba80 feat(sources): live sources panel with stage timeline
8f88a2f feat(upload): resumable uploads and the upload dialog
3da5344 build(worker): production image
adb4fdb test(worker): pipeline suite with fixtures
91e0c8a feat(queue): ingestion on Inngest with cleanup jobs
05b71cf feat(worker): figures and captions
ad71e05 feat(worker): page-aware chunks and embeddings
a1a31e1 feat(worker): docling parsing with OCR fallback
d6a638f feat(worker): file validation and stage reporting
c9eebd3 feat(notebooks): board view with drag and drop
58de266 feat(notebooks): notebooks page with grid, list and empty states
ecc487a feat(notebooks): data layer and actions
a407c63 feat(db): notebooks and ingestion schema
f6e8c8e docs(ingestion): spec and shared contract
```

## Fix plan

Ordered by severity. Each is one session.

1. **R6 + R4 — CI (reliability).** Add `.github/workflows/ci.yml`: web (lint, typecheck, test, build on
   Node 22), worker fast tests, a Docling job (`pytest -m docling`, cached models), an a11y/e2e job
   on the local Supabase stack, and `test:rls` against the TEST project secrets.
   *Done when:* the workflow is green on the `phase-3` PR.
2. **I5 — prove live cancellation (reliability).** E2E: start a slow ingest, Read again while it's
   parsing, assert the old run is cancelled in the Dev Server and only the new run's chunks remain.
   *Done when:* the test passes twice in a row.
3. **O6 — prove the Realtime fallback (reliability).** E2E: block the Realtime websocket with
   `page.route`, assert "Reconnecting…" appears and the card still reaches Ready by polling, then
   unblock and assert it goes back to live. *Done when:* the test passes.
4. **G8, H6, H7 — test the remaining upload entry points (reliability).** E2E for `beforeunload`
   (dialog event while uploading), dispatching a file drop on the window, and a clipboard paste.
   *Done when:* three tests pass.
5. **M4 — one live caption run (quality).** With real keys on one fixture, confirm captions are
   written and `caption usage` is logged; record the real cost next to the estimate.
   *Done when:* a figure has a model description and the log shows token counts.
6. **P2 — fonts (UX, needs your decision).** Either restore Hanken Grotesk/Literata per the skill,
   or record Inter as a deliberate change in the skill's notes section.
   *Done when:* the skill and `layout.tsx` agree.
7. **Q2, Q5 — keyboard and small screens (UX).** E2E for Browse files, source menu → Read again,
   Delete + Undo by keyboard; overflow and 44 px target checks at 320 px on Phase 3 pages.
   *Done when:* tests pass with zero axe issues.
8. **F2 — touch drag (UX).** Playwright touch emulation (`hasTouch`) long-press drag on the board.
   *Done when:* the card moves and persists.
9. **L3 — equations (quality).** Measure Docling formula enrichment cost on a math-heavy fixture;
   enable it if parse time stays within budget. *Done when:* a formula chunk contains LaTeX.

## Needs Hilal

| Item | What to do |
| --- | --- |
| B1, C1 | Create a separate Supabase **test** project. Put `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY` in a repo-root `.env.test`. Apply migrations 0001–0004 to it and to the **main** project (`npx supabase link --project-ref <ref> --workdir ../..` then `npx supabase db push --workdir ../..` from `apps/web`). Then run `npm run db:types` and `npm run test:rls`. |
| B4 | Confirm the duplicate index stays non-unique so "Add anyway" works (spec §13), or say you want it unique (then "Add anyway" goes away). |
| E11, H1 | Put a sample paper you're allowed to redistribute at `apps/web/public/samples/sample-paper.pdf` and write `docs/samples.md` (source, licence, attribution). The onboarding "sample paper" choice already loads it. |
| P2 | Decide on fonts (see fix plan 6). |
| S6 | Inngest: create the app, copy the **Event key** and **Signing key**. Railway: a service from this repo with Dockerfile `services/worker/Dockerfile`, build context = repo root, ≥ 4 GB RAM, health check `/ready`, and the worker variables. Vercel: the web variables plus both Inngest keys (no `INNGEST_DEV`). Then sync both `/api/inngest` URLs in Inngest. |
| S7 | After S6: sign in on the deployed app, create a notebook, upload a paper, watch it go Ready, check its chunks have pages, delete it, and check its storage folder is empty a minute later. |
| — | Confirm the free source limit (20) is per notebook (spec §17). |

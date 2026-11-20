# Progress log

Append-only. One entry per finished task: date, task id, 2–3 lines on what changed and anything notable.

## 2026-11-19 — P1 web scripts (typecheck, Vitest, Prettier)

- Added `typecheck`, `test`, `test:watch`, `format`, `format:check`; Vitest 5 + Vite 8 (native tsconfig paths,
  no `vite-tsconfig-paths`), Prettier + Tailwind plugin; codebase formatted once; 4 tests for `formatContext`.
- `retrieval.ts` creates the OpenAI client lazily. `npm test` runs via `scripts/vitest.mjs` to dodge a Vitest
  bug with lowercase `c:\` cwd on Windows. Added `apps/web/.npmrc` (strict peer deps, overrides user
  `legacy-peer-deps=true`) and root `.gitattributes` (LF everywhere).

## 2026-11-19 — P1.0 token alignment with the design skill (supersedes Phase 0 P8)

- `globals.css` rewritten to skill 2.6: tokens on `:root, .light` / `.dark` (nested wrappers re-theme),
  shadcn mapping, status, diagram palette, radius xs–lg, ink-tinted shadows, motion tokens,
  `graph-paper`, `shimmer`, reduced-motion rule. Tailwind's default palette/shadows/radii/text sizes
  removed. Fonts: Hanken Grotesk, Literata (lazy), JetBrains Mono — variable files via next/font.
- Type roles `text-display`…`text-code` + `measure`; `cn` taught the roles (it was dropping `text-h1`
  next to `text-ink`). `/dev/tokens` shows everything in light and dark; 404 in production.
- Verified: lint, typecheck, 52 tests (contrast parsed from globals.css), build, grep clean, screenshots
  at 1440/390 reviewed. Open: light success/warning are 4.3/4.1:1 as small text (see backlog).

## 2026-11-19 — P1.1 — Buttons, icon button, split button, copy button

- Button, IconButton, SplitButton, CopyButton per spec; Tooltip, Kbd and DropdownMenu pulled forward (buttons need them).
- Custom hover/active/focus-visible variants also match data-force, so the showcase shows every state statically.
- Verified: 17 tests incl. axe; screenshots at 4 widths in both themes. Test stack: jsdom + Testing Library + axe-core (vitest-axe is unmaintained).

## 2026-11-19 — P1.2 — Inputs

- Field wiring, Input, SearchInput, Textarea, Select, Combobox, Checkbox, RadioCard, Switch, SegmentedControl.
- Verified: 13 tests incl. keyboard paths and axe on a full form.

## 2026-11-19 — P1.3 — Display components

- StatusPill, LevelFlag, Avatar(+Stack), Progress (bar/dots/ring), Skeleton + DelayedSkeleton + presets, EmptyState.
- Added success/warning/danger-strong tokens for status words on tints (light success/warning alone are 4.3/4.1:1).
- Verified: 19 tests incl. fake-timer tooltip delay and DelayedSkeleton; axe clean.

## 2026-11-19 — P1.4 — Overlays

- Modal + TypedConfirmDialog, Sheet (side, or bottom with snap points), DropdownMenu finished, Popover citation preview, sonner Toaster.
- Overlays portal into the showcase column (PortalContainerProvider), so overlays opened in the dark column are dark.
- Verified: 6 tests (focus trap and return, typed confirm, snaps, menu typeahead and submenu, Undo); axe on the open dialog.

## 2026-11-19 — P1.5 — Navigation

- Tabs, BreadcrumbSwitcher, Sidebar (item/section/group/collapse toggle), WorkspaceSwitcher, UserCard.
- Collapse approach: the width snaps 272/72px with no width animation (skill 7.3); groups expand with grid-template-rows 0fr to 1fr and go inert when closed. Radix Collapsible.Content unmounts when closed, so only its Root and Trigger are used.
- Verified: 6 tests (underline follows, aria-current, persisted group state); axe clean.

## 2026-11-19 — P1.6 — Data table and pagination

- DataTable (TanStack v9 tableFeatures API), Pagination, RelativeTime.
- Verified: 9 tests (sort cycle, select-all, Shift range, bulk Undo toast, states, pagination math); axe clean; no overflow at 320 or 390.

## 2026-11-19 — P1.7 — Settings group and rows

- SettingsSection/Group/Row/SubOptions + useAutoSave (Saved toast; error toast with Try again).
- Whole page: real-browser axe (WCAG 2.1 A/AA, light and dark) 0 violations; no horizontal overflow at 320/390; 129 tests; build passes.
- Open: P1.8 (Playwright e2e specs + CI a11y job) needs Phase 0 P3 (CI).

## 2026-11-19 — P2.1 — profiles table, signup trigger, RLS (+ level names)

- Migration 0002 applied to the project with `supabase db push --remote`; types regenerated (`npm run db:types`).
- Pulled Phase 0 P4/P7/P10 (web side) forward: typed clients, env.ts, errors.ts, logger with email masking.
- Open: the trigger check against a TEST project needs `.env.test`.

## 2026-11-19 — P2.2 — Auth pages (email, OTP, magic link, Google, GitHub, reset) + branded emails

- Auth pages and flows per spec; verify email kept in an httpOnly cookie, not the URL; `safeNext()` on every redirect.
- Verified: unit tests (OtpInput, auth errors), e2e (sign-in steps, axe on 6 pages x 2 themes, 320px fit), screenshots 1440/390/320.
- Open: paste docs/email-templates into Supabase; manual Google/GitHub check on localhost.

## 2026-11-19 — P2.3 — Session refresh and route protection

- Proxy + server guards (defence in depth); onboarding check lives in the (app) layout, not the proxy.
- Verified: routeDecision unit tests; e2e for redirects with next, 401 JSON, no off-site redirects.

## 2026-11-19 — P2.4 — Desktop app shell

- Shell per spec; sidebar width snaps (no width animation); level switch saves to the profile.
- Verified: unit tests (aria-current, Ctrl+B persistence, Ctrl+K navigation, linked accounts), e2e + axe light/dark, screenshots 1440-768.
- Removed one accessory: the plan badge appeared in both the switcher and the breadcrumb; kept it in the switcher.

## 2026-11-19 — P2.5 — Mobile shell (bottom tab bar)

- Tab bar with 44px+ targets and safe-area padding; content padded so nothing hides under it.
- Verified: e2e at 390x844 (active tab, Ask sheet, drawer closes with Esc, 44px targets, axe) and no overflow at 320px.

## 2026-11-19 — P2.6 — Onboarding (once, skippable, resumable)

- Onboarding per spec, left-aligned 560px column, one primary action per step, no celebration motion.
- Verified: schema tests reject invalid input; e2e axe on every step light/dark; one primary action per step.
- Open: resume/skip end-to-end needs the test project (e2e/authed.spec.ts); step 4 upload wiring is a Phase 3 TODO.

## 2026-11-19 — P2.7 — RLS proof with two test accounts (in progress)

- Test suite and migration 0003 written; `npm run test:rls` stops with a clear message until `.env.test` exists.
- Open: create the test project, apply 0001-0003, add `.env.test`, run test:rls; apply 0003 to the main project; CI job after Phase 0 P3.

## 2026-11-19 — P2.8 — Phase 2 polish and audit (in progress)

- Audit: browser axe (WCAG 2.1 A/AA, light + dark) 0 violations on auth pages, shell (1440/390) and all onboarding steps; no overflow at 320px.
- Security: no off-site redirects (`//evil.com`, `https://evil.com`, `/\evil.com`); client bundle has no server env names or secret values (only supabase-js's `sb_secret_` prefix check); verify cookie httpOnly, `secure` in production; auth copy never reveals account existence; rate-limit message mapped.
- Checks: lint, typecheck, 180 unit/component tests, build, 33 e2e passed (signed-in flow skipped until the test project exists).
- Open (needs you): OAuth manual check, signed-in e2e and test:rls on the test project.

## 2026-11-19 — P3.0 — Ingestion spec and shared contract

- `docs/specs/ingestion.md` (flow, stage machine, errors, limits, storage, events, idempotency, cancellation, retries, acceptance) and `contracts/ingestion.json`; loaders in `src/lib/ingestion/contract.ts` (generated copy, since Turbopack can't import outside apps/web) and `app/contract.py` (pydantic).
- Verified: vitest (validity, drift, broken-contract cases, helpers) writes `contracts/fixtures/ingestion-cases.json`; pytest asserts Python gives identical answers (mutating the contract makes it fail). Worker pytest is now set up (`pytest.ini`, `requirements-dev.txt`).
- Open: confirm the source quota is per notebook; the worker image must include `contracts/` (P3.14).

## 2026-11-19 — P3.1 — Database: notebooks and ingestion schema

- Migration 0004: notebook board columns (`position` in "C" collation), document stages + run ids (`ingest_run_id` processing, `ready_run_id` published), chunk/figure run keys and positions, `set_document_stage()`, `finalize_ingest()`, `start_ingest_run()` (service role only), `hybrid_search()` over published runs, Realtime, bucket limits, `ingest-artifacts` bucket. A trigger chooses `storage_path`; column grants stop people writing pipeline columns.
- Verified on the local stack (`npx supabase start`, `npm run test:rls:local`): 73 tests incl. contract-vs-SQL transitions, stale/backward moves, atomic swap, search during re-process, Realtime to owner only, bucket limits. Old `/api/documents` route removed (P3.10 replaces it); chat reads published runs.
- Open: apply 0003 + 0004 to your test and main projects; the old worker `main.py` no longer matches the schema until P3.5/P3.6.

## 2026-11-19 — P3.2 — Notebooks data layer and actions

- `src/lib/notebooks/` (shared schemas, fractional ordering, filter/sort; repo taking the caller's client), server actions (create, update with `updated_at` conflict check, move, touch, soft delete + `notebook/deleted` event, restore), `GET /api/notebooks`, hard-delete cleanup in `src/lib/cleanup.ts`.
- Verified: unit tests (schemas, positions incl. 50 random moves, filter/sort); database suite as two people (ownership 404s, order, soft delete/restore, conflict returns the fresh row, opening isn't an edit, live source counts, hard delete empties both buckets). 81 database tests pass locally.
- Open: the hard-delete queue function is wired in P3.5.

## 2026-11-19 — P3.3 — Notebooks page: grid and list, create/rename/delete, empty states

- `/app/notebooks`: header + New notebook (Ctrl/⌘ N from the shell), Grid · List · Board switch (in the URL, remembered), search (150 ms debounce), status/subject filters, sort; responsive grid 1/2/3/4; list view on DataTable with bulk Move to… and Delete; create/edit dialog (subject combobox with "Use …", five named colour swatches, exam date); inline rename (Enter/Esc); delete with Undo, no confirm; first-notebook and no-results empty states; 300 ms skeleton; error with Try again. Sidebar shows recent notebooks + View all; Home links to New notebook.
- Verified: lint, typecheck, 232 unit tests; `npm run e2e:local` (local stack) 7/7 incl. axe light/dark at 1440 and 390 in all three views and keyboard-only create.

## 2026-11-20 — P3.4 — Board view with drag and drop

- Board on @dnd-kit: mouse (6 px), touch (250 ms long press) and keyboard (Space, arrows, Space; Esc cancels) with spoken announcements ("Picked up Alpha. To read, position 1 of 3."). Lifted card uses shadow-3 with no rotation; dashed placeholder; target column highlighted; counts update on drop; empty columns read "Drag notebooks here". Optimistic move with rollback + error toast (network failures included). Reduced motion: no sortable transitions, no drop animation. Pure logic in `src/lib/notebooks/board.ts` (unit-tested).
- Mobile choice: columns stack vertically below 768 px instead of scrolling sideways (no overflow at 320 px, every card visible); long press starts a drag so swipes still scroll; "Move to…" in the card menu is the quick path.
- Verified: board unit tests; e2e (local stack) 5/5 — mouse drag persists after reload, keyboard within and across columns, Esc cancels, failed move rolls back, reduced motion, mobile stacking + axe.

## 2026-11-20 — P3.6 — Worker: page count + file validation; stage column updates

- `app/validate.py`: size cap, `%PDF-` in the first 1 KB, pypdfium2 open (password → `encrypted_pdf`, unreadable → `corrupt_pdf`), 0 pages → `corrupt_pdf`, > MAX_PAGES → `too_many_pages {pages, limit}`, SHA-256, scanned-page detection (< 20 chars + an image). `app/progress.py`: stage changes written at once, progress ≤ 1 write/s per document (pending value flushed before the next stage), spec bands, never backwards, contract detail lines; a refused write on a stale run raises `StaleRun`, a retried step adopts a stage the run already passed, an illegal jump raises.
- Also: `settings.py` (pydantic-settings, names-only errors), JSON logs with redaction (`log.py`), `store.py` (one interface over PostgREST/RPC/Storage; tests use an in-memory twin of the SQL rules), synthetic fixture generator (`tests/fixtures/make_fixtures.py`: paper_basic, scanned, blank_scan, encrypted, corrupt, not_pdf, too_many_pages, logo_repeat). Pinned requirements.
- Verified: every fixture maps to its contract code; 22 validate/progress tests incl. throttling with a fake clock and the skill's "120 MB" sentence.

## 2026-11-20 — P3.7 — OCR fallback for scanned pages

- `app/parse.py`: Docling with tables and picture crops (144 dpi); OCR only when validation found scanned pages, with RapidOCR on ONNX Runtime (models ship in the wheel / are baked into the image); honest page progress from Docling's `progress_callback` ("Reading page i of n", or "Running OCR on page i of n" over scanned pages); `document_timeout` + elapsed check → `parse_timeout`; no body text → `no_text_found`; at most two converters per process. Decisions recorded in spec section 9/17.
- Verified on real Docling: born-digital paper never enters `ocr` (`ocr_used = false`); the scanned fixture shows "Running OCR on page 1 of 1", becomes Ready and its known word is in a chunk; the blank scan fails with `no_text_found`.

## 2026-11-20 — P3.8 — Keep page numbers on chunks (page-aware chunking + embeddings)

- `app/chunking.py`: Docling HybridChunker with the embedding model's tokenizer (tiktoken cl100k_base, 400 tokens), Markdown tables (`kind = table`), headings, `page_start/page_end` within 1..page_count, bboxes converted to top-left PDF points (spec section 10), contextual embedding text ("Document: title" + heading path + text); running headers/footers (repeated short lines) and page numbers moved to furniture and dropped. `app/embed.py`: batches of 96, backoff on 429/5xx (5 tries), 1536-dim check, per-document token cap.
- Verified: paper_basic chunks all have valid pages, bboxes, headings, a table chunk; no "Preprint" header or page numbers in any chunk; embedding retry/batching/dimension tests.

## 2026-11-20 — P3.9 — Figures: extract and store; caption and embed

- `app/figures.py`: pictures with page, top-left bbox, label ("Fig. 3" → "Figure 3") and paper caption; tiny images and logos repeated on ≥ 3 pages skipped; largest 40 kept in reading order; WebP q85 ≤ 1600 px at `{user}/{doc}/figures/{run}/{n}.webp`. `app/captions.py` + `app/prompts/captioner.md`: FAST_MODEL (claude-haiku-5-5, effort low), 4 at a time, retries on 429/5xx, refusal or failure keeps the paper caption, cache by image hash (same person only), token usage logged. One `figure_caption` chunk per figure with `figure_id`, page and bbox.
- Verified: paper_basic → 2 figures with labels/captions/WebP; logo_repeat keeps only the real figure; a failed caption keeps the figure and document Ready.

## 2026-11-20 — P3.5 — Move ingestion to a queue (Inngest) + cleanup jobs

- Worker serves `ingest-document` at `/api/inngest` (Inngest Python SDK): trigger `document/uploaded`, concurrency 2 + 2 per `user_id`, 3 retries per step, idempotency on `run_id`, `cancelOn` reprocess (same document, different run), deleted (same document), notebook deleted (same notebook); `on_failure` → `internal`. Steps validate → parse → figures → captions → index → finalize, each with the current-run guard (`app/pipeline.py`). Signatures enforced unless INNGEST_DEV; unsigned sync refused in production; old `POST /ingest` + shared secret removed (and `WORKER_URL`/`WORKER_SECRET`).
- Web serves `cleanup-document`, `cleanup-notebook` (sleep 30 s, then hard delete if still deleted), `sweep-stale-uploads` (every 30 min) and `sweep-orphans` (daily, also fails runs stuck 2 h) at `/api/inngest`. README "Run locally" documents the three processes.
- Verified: queue config tests (concurrency, retries, cancel expressions, idempotency, unsigned requests rejected in production); sweepers against the local stack (3 tests); the full pipeline through the real SupabaseStore into Postgres. `WORKER_FAKE_AI=1` (dev only) for free local e2e.

## 2026-11-20 — P3.13 — Worker test suite with fixtures

- `tests/test_pipeline.py` (real Docling on generated fixtures, in-memory store): paper_basic → Ready with chunks > 0, headings, pages within 1..page_count, top-left bboxes, a table chunk, 2 figure-caption chunks tied to figures, stage order validating → parsing → reading_figures → indexing → ready, honest detail lines, monotonic progress, contextual embedding text, doc.json saved; every step idempotent (no re-parse, no re-embed, no duplicate rows); re-process mid-run leaves no old-run rows; scanned → OCR; blank scan → no_text_found; bad files fail with their codes; logos skipped; parse_timeout final; unexpected errors left for the queue to retry. Plus unit tests (embeddings, captions, figures, chunk helpers), queue/HTTP tests and a local-stack test through the real SupabaseStore.
- Result: 413 passed (3 stack tests skip without TEST_SUPABASE_*; they pass with the local stack). Coverage: app 90%, app/pipeline.py 95% (store.py is covered by the stack test).

## 2026-11-20 — P3.10 — Upload flow (resumable) + upload modal

- API: `POST /api/notebooks/[id]/documents` (ownership via RLS, `.pdf`, size, per-notebook quota, duplicate → 409 `duplicate_file` with the existing id; "Add anyway" sends `force`), `POST /api/documents/[id]/uploaded` (stored object exists with the declared size → `queued` → `document/uploaded` with event id `uploaded-{run}`; idempotent), `POST /api/documents/[id]/cancel`. Storage paths always come from the contract on the server. Errors carry the contract's message, fix, values and actions.
- Browser: `src/lib/uploads/` — instant name/size checks; a Web Worker hashes (SHA-256) and opens the PDF with pdf.js for the page count and password (owner-only restrictions pass); an upload manager outside React (3 at a time, the rest Queued; ≤ 10 per drop) with resumable TUS uploads to Supabase Storage (6 MB chunks, fresh token per request), "Waiting for connection…" and automatic resume, confirm with retries, cancel, `beforeunload` warning. Upload dialog: dashed drop zone with the drop wash, Browse files, "Paste a link" disabled with Coming soon, rows with name/size/progress/reason/fix/actions, aria-live milestones; full-window drop zone; paste a PDF; Ctrl/⌘ U.
- Verified: 11 manager tests; e2e on the local stack with the real queue and worker: upload → Ready live; dropped connection resumes; bad files fail at once with reason + fix and store nothing; duplicates; cancel removes the row and the partial file. Found and fixed: pdf.js posts its own messages from the scan worker (replies are now tagged).

## 2026-11-20 — P3.11 — Live pipeline progress (notebook sources view)

- `/app/notebooks/[id]`: 272 px Sources panel (cards: PDF icon, middle-truncated name, contract word + honest detail line, progress bar, menu; failed cards show reason, fix and the fix button; selected card has a 2 px left edge), empty state with Add source, files appear in place the moment they're dropped. Detail view with the stage timeline and durations from `stage_timings`. Ready plays the 1.5 s success emphasis, then settles.
- Live: Realtime `postgres_changes` filtered by notebook (RLS limits rows to the owner), merge rules in `src/lib/documents/live.ts` (older runs ignored, no backwards stage or progress, deletes leave at once), resubscribe with backoff + 5 s polling and a quiet "Reconnecting…" line; background tab title "(2 reading) Notebook — TensorLM".
- Verified: 10 live-store tests; e2e records every stage the card shows: uploading → reading → indexing → ready in order, no page reload, then the stage timeline. Fixed on the way: StrictMode reused a Realtime channel name; the app layout read the clock during prerender (`await connection()`).

## 2026-11-20 — P3.12 — Re-process and delete with cleanup

- `POST /api/documents/[id]/reprocess` (new run via `start_ingest_run`, `document/reprocess` cancels the old run, then `document/uploaded`; old chunks stay searchable until finalize; 3 per document per hour), `DELETE /api/documents/[id]` (soft delete + `document/deleted`), `POST .../restore` (Undo; restarts a run the delete cut short), `GET .../download` (303 to a 60 s signed URL with the original filename). Notebook Undo restarts interrupted runs. Delete source → "Source deleted" toast with Undo (8 s), no confirm.
- Verified: e2e delete → hidden → Undo → back; Read again → new run → Ready; delete again → `cleanup-document` hard-deleted the row and all 7 stored files after the 30 s window (queue log). Sweeper DB tests on the local stack.

## 2026-11-20 — Cost note: one 20-page paper (Phase 3 S8)

- Embeddings (`text-embedding-3-small`, $0.02 / 1M tokens): ~500 words/page → ~13k tokens of text, plus the contextual prefix (title + heading path, ~20 tokens × ~35 chunks) ≈ 14k tokens → **≈ $0.0003**.
- Figure captions (`claude-haiku-5-5`, $0.10 in / $0.50 out per 1M, effort low): per figure ≈ 2,100 image tokens (1600 × 1000 WebP) + ~300 prompt/context in, ~350 out incl. thinking → ≈ $0.0004; 8 figures **≈ $0.0034**. Cache by image hash makes re-processing the same paper free.
- Total **≈ $0.004 per 20-page paper** (well under a cent). Estimates, not measurements: the e2e and load tests ran with `WORKER_FAKE_AI=1`; the worker logs real `caption usage` and `embedding_tokens` per document, so check them on the first real uploads.

## 2026-11-20 — P4.0 — Answer spec + contract

- `docs/specs/answers.md` (flow, routing, context format and prompt-injection rule, answer format, citations, levels, no-match, stop/continue/regenerate, states, feedback, limits, cost, acceptance) and `docs/specs/answers.examples.md` (one question at three levels).
- `contracts/answer-format.json` → `src/lib/answers/format.generated.ts` (sync script now handles both contracts) + zod loader `src/lib/answers/format.ts` (levels, directives, chart schema, commands, limits); `src/lib/models.ts` (models + prices + cost). 13 tests.

## 2026-11-20 — P4.1 — Database: chats, messages, feedback, notes, source selection

- Migration 0005: chats gain level, title_generated, summary, last_message_at, soft delete (column grants: people insert/rename/level/delete only); messages gain user_id, parts, status, mode, command, selected sources, followups, parent/version, model, prompt_version, usage, latency, flags — **read-only for people** (the chat route writes them with the service role after an ownership check, so citations/usage can't be forged); new `feedback` (one row per person per message) and `notes` tables with RLS; source selection is `documents.included` (one row per source already exists, RLS + Realtime cover it). `messages.content` stays the plain-text copy.
- Verified on the local stack: `npm run test:rls:local` 102 passed (feedback and notes added to the coverage list; B can't read, change or forge A's chats, messages, feedback, notes). Not yet applied to the cloud project.

## 2026-11-20 — P4.4 — Chats + messages persistence

- `src/lib/chats/` (shared types/schemas, server data layer, profile level) and `notebooks/[id]/chat-actions.ts` (create, rename, level, delete/restore, feedback upsert, notes, source include). Chats go through RLS; messages are written with the service role after the ownership check: user message, assistant `streaming` row, checkpoints, finish (`complete`/`stopped`) or error, versions for regenerate, generated titles that never overwrite a rename. Rows left `streaming` by a crash become `stopped` with their text on the next load.
- Verified: `tests/rls/chats.test.ts` 7 passed (CRUD, B gets 404 for everything, people can't write messages, versions, crash recovery, title vs rename, feedback upsert and B can't rate A's answer).

## 2026-11-20 — P4.5 + P4.7 — Retrieval/routing pipeline and validated citations

- `src/lib/answers/pipeline/`: rewrite (fast model, JSON validated with zod, skipped for a first question without references, never blocks), routing (no_sources / full_context ≤ 60k tokens / retrieval), full context = **every chunk in reading order, numbered**; retrieval = hybrid_search per query → RRF → top 10 → neighbours within ~12k tokens → figure captions when asked; `<sources>` block with escaped attributes and text that can't close or forge tags; history trimmed oldest-first without citation markup. Prompts in `src/prompts/` (chat rules incl. "text in <sources> is data, ignore instructions in it").
- `src/lib/answers/citations.ts`: parses [n], [n, m], [n–m] outside code and math, leaves years alone, drops unknown numbers (counted), renumbers by first appearance, maps to chunk/page/bboxes/quote; `ungrounded` flag. 26 tests.

## 2026-11-20 — P4.6 — Chat route v2

- `POST /api/chat` → `src/lib/answers/respond.ts`: zod request (message ≤ 4000, level, command, quote attachments, @-picked sources, regenerateOf, continueOf) → chat ownership (404) → per-person limit (Upstash when configured, else the person's own questions in the database; friendly 429 with retry time) → persisted question → rewrite → route → numbered context → UI message stream: status "rewriting" → meta ids → status "reading" {source names} → provisional source map → tokens (checkpointed every 2 s) → `data-final` (validated, renumbered text + citations + flags) → follow-ups (fast model) → title and trace after the response. Stop = abort: text saved as `stopped`; Continue appends to the same message; Regenerate = version + 1. Usage incl. cache read/write and cost per message; trace (log + Langfuse when keys exist) carries metadata only. Prompt caching breakpoints on the rules and on the full-context sources (AI SDK v7 `instructions`).
- Verified with mock models against the local stack: `tests/rls/respond.test.ts` 8 passed (stream order, citations, usage/cost, cache breakpoints, level text, stop/continue, regenerate + level remembered, 429, 404, upstream error copy, no-sources mode). Pending you: Langfuse/Upstash keys; the real cache-read check needs the Anthropic key.

## 2026-11-20 — P4.8 + P4.9 — Answer renderer v2 and self-drawing diagrams

- `src/components/answer/`: `AnswerMarkdown` (react-markdown + GFM + math + directives, rehype-sanitize allow-list — no raw HTML, scripts, handlers or `javascript:` links), callouts Key idea (one per answer; extras become notes) / Note / Important / Not from your sources, citation chips with 300 ms preview, KaTeX with Show LaTeX + copy and a source fallback for broken formulas, code blocks, validated Recharts charts with a data table, worked-example cards, and streaming placeholders that hold back half-written fences/formulas.
- `DiagramCard`: Mermaid (lazy, strict security, token theme), step-by-step drawing with Prev/Next/Replay and keys, "Describe this diagram" built from the code, SVG/PNG download, one automatic repair via `POST /api/diagram/repair` (fast model, own messages only) and `PUT` to save the fix into the message. Verified: 12 renderer tests (incl. axe on the spec's example answers), 3 describe tests, `tests/rls/diagram-repair.test.ts` 4 passed.

## 2026-11-20 — P4.3 — Sources pane: use in answers

- Ready source cards get a "Use … in answers" checkbox (`documents.included`, `setSourceIncluded` action, optimistic with rollback); unticked sources dim and are skipped by retrieval. The composer shows "Asking k of n sources" (or the @-picked ones). Selecting a source opens it in the canvas. Figures stay in Source details (canvas ⓘ) for now.

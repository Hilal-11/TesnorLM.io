# Backlog

## Phase 0 — Foundation

Milestone: repo runs locally, checks run in CI, design tokens exist in code.

- [x] P1 — Web scripts: typecheck, test (Vitest), format (Prettier)
- [ ] P2 — Worker: pytest + `app/chunking.py` + chunking tests
- [ ] P3 — GitHub Actions CI (web + worker jobs) — use Node 22, not 20 (Vitest 5 needs Node ≥ 22.12)
- [x] P4 — Supabase TypeScript types + `db:types` script (done in Phase 2)
- [ ] P5 — `src/lib/models.ts`: single source of model choice
- [ ] P6 — All LLM prompts in `src/prompts/`
- [ ] P7 — Env validation (zod for web, pydantic-settings for worker) — web `env.ts` done in Phase 2; worker settings and a startup check still open
- [x] P8 — Design tokens + `/dev/tokens` page — superseded by P1.0 (tokens follow the design skill)
- [x] P9 — Theme provider (light / dark / system), no flash (done in Phase 2: next-themes)
- [ ] P10 — Error and logging helpers — web errors/logger done in Phase 2; worker logging still open

## Phase 1 — Design system components

Milestone: `/dev/components` shows every core component in all states, in light and dark, built
only from TensorLM design tokens, keyboard-operable, with zero serious axe issues.

- [x] P1.0 — Token alignment: tokens, fonts and motion match the design skill
- [x] P1.1 — Buttons, icon button, split button, copy button
- [x] P1.2 — Inputs
- [x] P1.3 — Display components
- [x] P1.4 — Overlays
- [x] P1.5 — Navigation
- [x] P1.6 — Data table and pagination
- [x] P1.7 — Settings group and rows
- [ ] P1.8 — Accessibility pass (needs Phase 0 P3 CI for the a11y job)

Open design questions:

- [ ] Light `success` (#16855B, 4.30:1) and `warning` (#A86A00, 4.13:1) are below 4.5:1 as small
      text on `paper` (they pass 3:1 for icons). Decide: darken them in the skill, or only use them
      for icons/large text with ink words.

## Phase 2 — App shell & auth

Milestone: sign up (email, Google or GitHub), verify, log in, finish onboarding once, see the empty app
shell on desktop and mobile; every table private per user, proven by an automated test.

- [x] P2.1 — profiles table, signup trigger, RLS (+ level names)
- [x] P2.2 — Auth pages (email, OTP, magic link, Google, GitHub, reset) + branded emails
- [x] P2.3 — Session refresh and route protection
- [x] P2.4 — Desktop app shell
- [x] P2.5 — Mobile shell (bottom tab bar)
- [x] P2.6 — Onboarding (once, skippable, resumable)
- [ ] P2.7 — RLS proof with two test accounts — **waiting on you:** `.env.test` + test project with migrations 0001–0003
- [ ] P2.8 — Phase 2 polish and audit — **waiting on you:** OAuth manual check, signed-in e2e on the test project

Waiting on you (dashboards and secrets):

- [ ] Apply `supabase/migrations/0003_rls_fixes.sql` to the main project (`npx supabase db push --remote --workdir ../..` from apps/web) — fixes the documents/chats notebook-ownership hole
- [ ] Paste the four templates in `docs/email-templates/` into Supabase → Authentication → Emails
- [ ] Part A of the Phase 2 plan: URL config, Resend SMTP, Google + GitHub providers, manual linking, optional Turnstile
- [ ] Sign in with Google and GitHub on localhost and confirm the "Last used" badge (manual OAuth check)
- [ ] CI job for `test:rls` (needs Phase 0 P3 CI first)
- [ ] Phase 3: wire onboarding step 4 ("sample paper" / "upload my own") to real uploads (TODO in onboarding-wizard)

## Phase 3 — Sources & ingestion in the main shell (v2)

Milestone: from Home, add any supported source (files, web, YouTube, Drive, text, web search); every PDF is
accepted; text is askable within seconds (fast pass) and fully enriched later (deep pass); an overview and
5 suggested questions appear; 5 uploads at once all finish.
Plan: `docs/plans/TensorLM-v2-Part-A-Phases-3-4.md` (task prompts, shared rules, verification).
Specs: `docs/specs/product-flow.md`, `docs/specs/ingestion.md`; contract: `contracts/ingestion.json`.
v1 (done, extended by v2): P3.0–P3.13 — spec + contract, DB, notebooks CRUD/grid/list/board, Inngest queue,
validation, OCR, page-aware chunks, figures + captions, resumable uploads, live progress, reprocess/delete,
worker tests. v1 P3.14 (hardening, load test, deploy) folds into P3.15v2.

- [ ] S0 — Product spec v2, contracts v2 and design-skill amendment (confirmations, action colours) — parts 1–2 done; part 3 waits for your OK on the skill diff
- [ ] P3.1v2 — DB v2: source types, new stages, needs_password, datasets, notebook insights, notebook auto-title
- [ ] P3.2v2 — Notebooks data layer + Library page (grid, list, board) with confirmation dialogs
- [ ] P3.3v2 — Main shell: Home = lazy "Untitled notebook" workspace; sidebar notebooks; shallow URL change
- [ ] P3.4v2 — Add sources dialog: upload files, websites & YouTube, Google Drive, copied text, web search
- [ ] P3.5v2 — Upload pipeline v2: resumable uploads for every file type, sniffing, quotas (no rejection by type)
- [ ] P3.6v2 — Queue (Inngest): ingestion functions per source type, fast pass priority, retries, concurrency, cancel
- [ ] P3.7v2 — Accept-all PDF handling: repair, permission locks, password prompt, disguised files, scans, huge files
- [ ] P3.8v2 — Two-pass ingestion: fast pass (seconds) + deep pass (Docling) with atomic swap
- [ ] P3.9v2 — OCR fallback with honest status; page-aware chunking + embeddings; figures + captions as searchable chunks
- [ ] P3.10v2 — Other formats: DOCX, PPTX, HTML, Markdown, TXT, images, CSV, Excel, JSON (datasets)
- [ ] P3.11v2 — Web pages, YouTube transcripts, Google Drive files, copied text, web search import
- [ ] P3.12v2 — Notebook guide: auto title, overview, 5 suggested questions, per-source summary
- [ ] P3.13v2 — Live progress UI in the sources pane (Realtime + polling fallback)
- [ ] P3.14v2 — Remove, reprocess and delete with confirmation dialogs and full cleanup
- [ ] P3.15v2 — Tests (all formats), load test (5 and 10 at once), hardening, deploy

Waiting on you (Phase 3):

- [ ] v2: Google Cloud — enable Drive API + Picker API, browser API key (referrer-restricted), OAuth web client origins, `drive.file` scope, project number → `NEXT_PUBLIC_GOOGLE_API_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_APP_ID`
- [ ] v2: Web search provider account (e.g. Tavily) → `WEB_SEARCH_PROVIDER`, `TAVILY_API_KEY`
- [ ] v2: Choose YouTube transcripts: free library (accept failures) or paid API → `YOUTUBE_TRANSCRIPT_PROVIDER`
- [ ] v2: File size limit — stay at 50 MB (free Supabase) or upgrade to Pro and raise bucket limits; set `MAX_UPLOAD_MB`, `MAX_PAGES=2000`, `FAST_PASS_PAGE_BATCH=50`
- [ ] v2: Upstash Redis is now required for PDF passwords (10-minute TTL, never in the database)
- [ ] Confirm: the free source limit (20) is per notebook, not per account (spec section 17)
- [ ] Inngest app `tensorlm` + Production event and signing keys; Railway plan with ≥ 4 GB RAM
- [ ] Sample paper with a redistributable licence at `apps/web/public/samples/sample-paper.pdf` + `docs/samples.md`
- [ ] Phase 3 variables in `.env` (names in `.env.example`); test project gets every migration
- [ ] Apply migrations 0003 + 0004 to the test and main projects (`npx supabase db push` from the repo root, after `supabase link`), then `npm run db:types` — verified locally with `npm run test:rls:local`

## Chat Engine (do now, before the rest of Phase 4)

Milestone: in the main shell, "hi" gets a natural reply; general questions get rich answers; after a PDF is
processed 4–5 suggested questions appear and answers cite pages with native citations, inline figures and
self-drawing diagrams; the composer has no level selector.
Plan: `docs/plans/TensorLM-Chat-Engine-Phase.md`. Spec: `docs/specs/chat-engine.md`. API notes:
`docs/research/claude-api-notes.md`. Contract: `contracts/chat-events.json`.
Supersedes in Phase 4 v2: P4.0v2 (levels), P4.5v2 (intent classifier), P4.6v2/P4.7v2 (AI SDK route, `[n]`
parser), P4.11v2 (level selector).

- [ ] C0 — Read the docs; API notes, chat engine spec and event protocol — done except your review of spec section 1 (decisions D1–D11)
- [ ] C1 — Claude client, model registry, pricing, observability, error mapping
- [ ] C2 — Database changes (raw content, render, usage, attachments, chat system/tools versions)
- [ ] C3 — Context builder: search results, pack via tool results, search tool, figures, cache breakpoints
- [ ] C4 — Chat engine: streaming orchestration, tool loop, persistence, errors
- [ ] C5 — Citation mapping
- [ ] C6 — Suggested questions, follow-ups, chat titles
- [ ] C7 — Browser stream client and chat state
- [ ] C8 — Answer renderer v3
- [ ] C9 — Composer v3 (no level selector)
- [ ] C10 — Message actions and states
- [ ] C11 — Performance and cost verification
- [ ] C12 — Quality gate (eval:chat, security, accessibility, verification report)

Waiting on you (Chat Engine):

- [ ] Review spec section 1 (D1–D11), especially D3 (web search toggle), D6 (`CHAT_MAX_TOKENS` 32000) and D11 (refusal fallbacks on by default)
- [ ] Confirm the prices in `docs/research/claude-api-notes.md` §12 (from the official pricing page, 2026-11-20)
- [ ] Anthropic Console: monthly spend limit, usage tier/rate limits, web search enabled; credit on the account
- [ ] `.env` additions from the plan's Part B (copy to `apps/web/.env.local`)

## Phase 4 — Chat in the main shell (v2)

Milestone: in the main shell, small talk gets a natural reply, general questions work without sources, and a
question about the Transformer paper gets a streamed, cited answer with a self-drawing diagram, code or visual
when useful, at the chosen level.
Plan: `docs/plans/TensorLM-v2-Part-A-Phases-3-4.md`. Spec: `docs/specs/answers.md`; contract: `contracts/answer-format.json`.
v1 (done, extended by v2): P4.0–P4.14 — answer spec + contract, chats/messages/feedback DB, three-pane
workspace, sources pane, chat persistence, retrieval pipeline, streaming chat route, validated citations,
renderer + self-drawing diagrams, chat UI, composer, citation chips, PDF viewer, selection toolbar.
v1 P4.15 (quality gate) is partial: `docs/reports/phase-4-verification.md`.

- [ ] P4.0v2 — Answer spec v2 + contract (modes, visual blocks, thinking, suggestions)
- [ ] P4.1v2 — DB: chats, messages, feedback, source selection (modes, reasoning summary; notes stay in Phase 5)
- [ ] P4.2v2 — Workspace panes in the main shell: Sources · Conversation · Canvas (Diagram, Source); mobile tabs
- [ ] P4.3v2 — Sources pane: selection, figures, per-source summary, "N sources" in composer
- [ ] P4.4v2 — Chats persistence, chat switcher, new chat, auto titles (delete chat confirms)
- [ ] P4.5v2 — Pipeline: intent (small talk, general, grounded), rewrite, adaptive routing, numbered context
- [ ] P4.6v2 — Chat route v2: streaming, levels, optional thinking, prompt caching, tracing, rate limits, stop/continue
- [ ] P4.7v2 — Validated citations (transcript, dataset, web; survive the deep swap)
- [ ] P4.8v2 — Renderer v2 with visual blocks (diagram, chart, matrix, tensor shape, steps, compare, timeline) and code
- [ ] P4.9v2 — Self-drawing diagrams + Mermaid repair
- [ ] P4.10v2 — Chat UI: states, actions, follow-ups, feedback, "Thinking" collapsible
- [ ] P4.11v2 — Advanced composer: N sources, settings (level, length, visuals, thinking), attach, /, @, voice, drafts
- [ ] P4.12v2 — Citation chips + previews
- [ ] P4.13v2 — Source viewers: PDF (highlights), web page reader, YouTube transcript (timestamps), dataset table, documents
- [ ] P4.14v2 — Selection toolbar (Explain, Simplify, Diagram, Add to note, Copy)
- [ ] P4.15v2 — Quality gate: smoke evals (grounded, general, small talk, suggestions, formats), performance, a11y, security

Waiting on you (Phase 4):

- [ ] Langfuse project `tensorlm` keys (LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASEURL) — optional: tracing is skipped without them
- [ ] Upstash Redis (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN) — optional: the database limits chats without them
- [ ] Anthropic spend cap checked; "Attention Is All You Need" PDF uploaded to a notebook for manual testing (never committed)

## Phase 5 — Notes (v2, starts after Part A verification has zero FAIL)

Milestone: notes live on their own page with a rich editor, autosave and every common operation; answers and
passages save into notes with working citations.
Plan: `docs/plans/TensorLM-v2-Part-B-Phases-5-6.md`. Note: a v1 `notes` table already exists (migration 0005,
`notebook_id NOT NULL`, cascade delete), so P5.1 alters and migrates it.

- [ ] P5.1 — Notes schema, versions, trash, RLS (alter the v1 table; nullable notebook_id for Unfiled)
- [ ] P5.2 — /notes workspace: list, filters, search, full-page editor (no popups)
- [ ] P5.3 — Editor: rich text, checklists, code, math, diagrams, tables, images, citation chips, slash and bubble menus
- [ ] P5.4 — Operations: create, rename, duplicate, pin, tag, move, archive, delete (confirm), trash, export, version history
- [ ] P5.5 — Integrations: save answer to note, add passage to note, turn note into source, notes panel in notebook
- [ ] P5.6 — AI in notes: summarise, rewrite clearer, explain selection, continue writing (accept/discard)
- [ ] P5.7 — Notes quality gate (tests, a11y, performance)

## Phase 6 — Quality, depth and trust (v2)

Milestone: measured answer quality with a 50-question eval suite, full tracing, reranking, on-demand deep
explanations, runnable code examples and interactive visuals; trust-focused UI pass complete.
Plan: `docs/plans/TensorLM-v2-Part-B-Phases-5-6.md` (Part 9).

- [ ] P6.1 — Eval suite (50 questions, all source types) + promptfoo + baseline and CI gate
- [ ] P6.2 — Observability: Langfuse traces (metadata only), Sentry, cost dashboard
- [ ] P6.3 — Reranker (20 → 8) with measured improvement
- [ ] P6.4 — On-demand deep explanations and study guides (only when asked), saved as notes
- [ ] P6.5 — Runnable code: Python in a browser sandbox (Pyodide) with Run, output, timeouts
- [ ] P6.6 — Interactive visuals: attention heatmap, matrix-multiplication stepper, formula sliders (declarative specs only)
- [ ] P6.7 — Trust UI pass: confirmations, action colours, error and empty states, microcopy audit
- [ ] P6.8 — Phase 6 verification report

Waiting on you (Phase 6, later): reranker provider key (e.g. Cohere) or a local BGE model; Sentry projects for web and worker.

## Found in setup review — not yet scheduled

- [ ] Worker crashes in Docker: `main.py` uses `Path(__file__).parents[3]`, which doesn't exist at `/app/app/main.py`
- [x] `/api/documents` trusts client `filePath` — fixed in Phase 2 (path must be in the caller's folder, notebook must be theirs)
- [x] `/api/documents` doesn't verify the user owns `notebookId` — route check added; RLS fix in migration 0003 (not yet applied)
- [ ] `WORKER_SECRET` differs between root `.env` and `apps/web/.env.local` (the latter is still all placeholders)
- [ ] Storage bucket has no file size / MIME limits; `/api/chat` has no rate limit
- [ ] Mermaid renderer never recovers after a failed (partial, streaming) render
- [ ] `@tailwindcss/typography` plugin not enabled in `globals.css`; `--font-sans` references itself
- [ ] Worker image: unpinned deps, CUDA torch on Linux, Docling models downloaded at first request

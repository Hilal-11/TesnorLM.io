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

## Phase 3 — Notebooks & ingestion

Milestone: a person creates a notebook, uploads up to 10 PDFs at once on a patchy connection,
watches each move through honest live stages, and sees it Ready with page-aware chunks, figures and
captions in the database. Failures explain the reason and the fix. Five uploads at once all finish.
Spec: `docs/specs/ingestion.md`; contract: `contracts/ingestion.json`.

- [x] P3.0 — Ingestion spec + shared contract (TS and Python loaders, parity fixture)
- [x] P3.1 — Database: notebooks columns, document stages, chunks/figures by run, `finalize_ingest()`, `set_document_stage()`, Realtime, bucket limits, `ingest-artifacts` bucket
- [x] P3.2 — Notebooks data layer and actions (CRUD, ordering, soft delete)
- [x] P3.3 — Notebooks page: grid and list, create/rename/delete, empty states
- [x] P3.4 — Board view with drag and drop
- [x] P3.5 — Move ingestion to a queue (Inngest) + cleanup jobs
- [x] P3.6 — Worker: page count + file validation; stage column updates
- [x] P3.7 — OCR fallback for scanned pages
- [x] P3.8 — Keep page numbers on chunks (page-aware chunking + embeddings)
- [x] P3.9 — Figures: extract and store; caption and embed
- [x] P3.10 — Upload flow (resumable) + upload modal
- [x] P3.11 — Live pipeline progress (notebook sources view)
- [x] P3.12 — Re-process and delete with cleanup
- [x] P3.13 — Worker test suite with fixtures
- [ ] P3.14 — Production hardening, load test and deploy

Waiting on you (Phase 3):

- [ ] Confirm: the free source limit (20) is per notebook, not per account (spec section 17)
- [ ] Inngest app `tensorlm` + Production event and signing keys; Railway plan with ≥ 4 GB RAM
- [ ] Sample paper with a redistributable licence at `apps/web/public/samples/sample-paper.pdf` + `docs/samples.md`
- [ ] Phase 3 variables in `.env` (names in `.env.example`); test project gets every migration
- [ ] Apply migrations 0003 + 0004 to the test and main projects (`npx supabase db push` from the repo root, after `supabase link`), then `npm run db:types` — verified locally with `npm run test:rls:local`

## Phase 4 — Chat with sources

Milestone: in a notebook with the Transformer paper, "How does multi-head attention work?" streams an
answer in reading type, at the chosen level, with citations [1][2] that open the exact page with the
passage highlighted, a diagram that draws itself, correct formulas, and "Not from your sources" on
general knowledge. Chats persist and can be stopped, continued, regenerated and rated.
Spec: `docs/specs/answers.md`; contract: `contracts/answer-format.json`.

- [x] P4.0 — Answer spec + contract (levels, directives, blocks, citations, commands)
- [x] P4.1 — Database: chats, messages, feedback, notes, source selection
- [ ] P4.2 — Notebook workspace layout (tabs, resizable panes, canvas)
- [ ] P4.3 — Sources pane: include/exclude, figures, add source
- [x] P4.4 — Chats + messages persistence; chat list per notebook; new chat
- [x] P4.5 — Retrieval and routing pipeline (rewrite, route, numbered context, history)
- [ ] P4.6 — Chat route v2 (streaming status, levels, prompt caching, tracing, rate limits)
- [x] P4.7 — Structured citations (server mapping and validation)
- [ ] P4.8 — LessonRenderer v2 (directives, math, code, charts, sanitize)
- [ ] P4.9 — Diagram card: self-drawing diagrams + Mermaid auto-repair
- [ ] P4.10 — Chat UI (states, actions, follow-ups, feedback)
- [ ] P4.11 — Prompt box (composer)
- [ ] P4.12 — Citation chips with hover preview
- [ ] P4.13 — PDF viewer pane with highlights
- [ ] P4.14 — Text selection in PDF → floating toolbar; notes
- [ ] P4.15 — Quality gate: smoke evals, performance, accessibility, audit

Waiting on you (Phase 4):

- [ ] Langfuse project `tensorlm` keys (LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASEURL) — optional: tracing is skipped without them
- [ ] Upstash Redis (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN) — optional: the database limits chats without them
- [ ] Anthropic spend cap checked; "Attention Is All You Need" PDF uploaded to a notebook for manual testing (never committed)

## Found in setup review — not yet scheduled

- [ ] Worker crashes in Docker: `main.py` uses `Path(__file__).parents[3]`, which doesn't exist at `/app/app/main.py`
- [x] `/api/documents` trusts client `filePath` — fixed in Phase 2 (path must be in the caller's folder, notebook must be theirs)
- [x] `/api/documents` doesn't verify the user owns `notebookId` — route check added; RLS fix in migration 0003 (not yet applied)
- [ ] `WORKER_SECRET` differs between root `.env` and `apps/web/.env.local` (the latter is still all placeholders)
- [ ] Storage bucket has no file size / MIME limits; `/api/chat` has no rate limit
- [ ] Mermaid renderer never recovers after a failed (partial, streaming) render
- [ ] `@tailwindcss/typography` plugin not enabled in `globals.css`; `--font-sans` references itself
- [ ] Worker image: unpinned deps, CUDA torch on Linux, Docling models downloaded at first request

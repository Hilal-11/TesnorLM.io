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
- [ ] P2.2 — Auth pages (email, OTP, magic link, Google, GitHub, reset) + branded emails
- [ ] P2.3 — Session refresh and route protection
- [ ] P2.4 — Desktop app shell
- [ ] P2.5 — Mobile shell (bottom tab bar)
- [ ] P2.6 — Onboarding (once, skippable, resumable)
- [ ] P2.7 — RLS proof with two test accounts — **waiting on you:** `.env.test` + test project with migrations 0001–0003
- [ ] P2.8 — Phase 2 polish and audit — **waiting on you:** OAuth manual check, signed-in e2e on the test project

Waiting on you (dashboards and secrets):

- [ ] Apply `supabase/migrations/0003_rls_fixes.sql` to the main project (`npx supabase db push --remote --workdir ../..` from apps/web) — fixes the documents/chats notebook-ownership hole
- [ ] Paste the four templates in `docs/email-templates/` into Supabase → Authentication → Emails
- [ ] Part A of the Phase 2 plan: URL config, Resend SMTP, Google + GitHub providers, manual linking, optional Turnstile
- [ ] Sign in with Google and GitHub on localhost and confirm the "Last used" badge (manual OAuth check)
- [ ] CI job for `test:rls` (needs Phase 0 P3 CI first)
- [ ] Phase 3: wire onboarding step 4 ("sample paper" / "upload my own") to real uploads (TODO in onboarding-wizard)

## Found in setup review — not yet scheduled

- [ ] Worker crashes in Docker: `main.py` uses `Path(__file__).parents[3]`, which doesn't exist at `/app/app/main.py`
- [x] `/api/documents` trusts client `filePath` — fixed in Phase 2 (path must be in the caller's folder, notebook must be theirs)
- [x] `/api/documents` doesn't verify the user owns `notebookId` — route check added; RLS fix in migration 0003 (not yet applied)
- [ ] `WORKER_SECRET` differs between root `.env` and `apps/web/.env.local` (the latter is still all placeholders)
- [ ] Storage bucket has no file size / MIME limits; `/api/chat` has no rate limit
- [ ] Mermaid renderer never recovers after a failed (partial, streaming) render
- [ ] `@tailwindcss/typography` plugin not enabled in `globals.css`; `--font-sans` references itself
- [ ] Worker image: unpinned deps, CUDA torch on Linux, Docling models downloaded at first request

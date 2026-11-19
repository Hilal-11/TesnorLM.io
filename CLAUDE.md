# TensorLM

Upload any paper, understand it deeply: AI explanations with diagrams, examples, math and citations.

## Layout

- `apps/web` — Next.js 16 App Router + TypeScript + Tailwind v4 + shadcn. **Read `apps/web/AGENTS.md`:**
  Next.js APIs here differ from older versions; check `apps/web/node_modules/next/dist/docs/` before
  writing Next-specific code.
- `services/worker` — Python FastAPI ingestion worker (Docling parse → chunk → embed → Postgres).
- `supabase/migrations` — Postgres schema, pgvector, RLS, `hybrid_search()`, storage bucket.
- `docs/backlog.md` — task list (tick tasks here). `docs/progress.md` — append-only work log.

## Commands

Web (`cd apps/web`):

- `npm run dev` — dev server on http://localhost:3000
- `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`
- `npm run format` · `npm run format:check`

Worker (`cd services/worker`):

- Windows: `.\.venv\Scripts\python.exe -m pytest -q`
- Linux/CI: `python -m pytest -q`

## Working loop (every task)

1. Plan briefly, then work in small steps.
2. Run the task's checks. If anything fails: read the error, fix, re-run.
3. At most 5 fix attempts on the same error — then stop and report.
4. Never mark a task done while checks fail.
5. Finish: tick the task in `docs/backlog.md`, append a 2–3 line entry to `docs/progress.md`,
   and make one commit for the task.

## Rules

- Never read, print or edit `.env` or `apps/web/.env.local`. Document variables in `.env.example`.
- Never push to `main` and never merge. Work on branches; the user opens and merges PRs.
- Ask the user before anything that needs their login (Supabase CLI, `gh auth`).
- Dev machine is Windows (PowerShell); CI is Linux. Keep scripts cross-platform.

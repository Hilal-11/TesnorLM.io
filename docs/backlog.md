# Backlog

## Phase 0 — Foundation

Milestone: repo runs locally, checks run in CI, design tokens exist in code.

- [ ] P1 — Web scripts: typecheck, test (Vitest), format (Prettier)
- [ ] P2 — Worker: pytest + `app/chunking.py` + chunking tests
- [ ] P3 — GitHub Actions CI (web + worker jobs)
- [ ] P4 — Supabase TypeScript types + `db:types` script
- [ ] P5 — `src/lib/models.ts`: single source of model choice
- [ ] P6 — All LLM prompts in `src/prompts/`
- [ ] P7 — Env validation (zod for web, pydantic-settings for worker)
- [ ] P8 — Design tokens + `/dev/tokens` page
- [ ] P9 — Theme provider (light / dark / system), no flash
- [ ] P10 — Error and logging helpers

## Found in setup review — not yet scheduled

- [ ] Worker crashes in Docker: `main.py` uses `Path(__file__).parents[3]`, which doesn't exist at `/app/app/main.py`
- [ ] `/api/documents` trusts client `filePath` — worker downloads it with the service-role key (cross-user file read)
- [ ] `/api/documents` doesn't verify the user owns `notebookId` (RLS on `documents` only checks `user_id`)
- [ ] `WORKER_SECRET` differs between root `.env` and `apps/web/.env.local` (the latter is still all placeholders)
- [ ] Storage bucket has no file size / MIME limits; `/api/chat` has no rate limit
- [ ] Mermaid renderer never recovers after a failed (partial, streaming) render
- [ ] `@tailwindcss/typography` plugin not enabled in `globals.css`; `--font-sans` references itself
- [ ] Worker image: unpinned deps, CUDA torch on Linux, Docling models downloaded at first request

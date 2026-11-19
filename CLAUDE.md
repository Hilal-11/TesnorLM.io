# TensorLM

Upload any paper, understand it deeply: AI explanations with diagrams, examples, math and citations.

## Layout

- `apps/web` — Next.js 16 App Router + TypeScript + Tailwind v4 + shadcn. **Read `apps/web/AGENTS.md`:**
  Next.js APIs here differ from older versions; check `apps/web/node_modules/next/dist/docs/` before
  writing Next-specific code.
- `services/worker` — Python FastAPI ingestion worker (Docling parse → chunk → embed → Postgres).
- `supabase/migrations` — Postgres schema, pgvector, RLS, `hybrid_search()`, storage bucket.
- `docs/backlog.md` — task list (tick tasks here). `docs/progress.md` — append-only work log.

## Design rules

Follow `.claude/skills/tensorlm-design/SKILL.md`; it overrides older docs and prompts. Tokens live in
`apps/web/src/app/globals.css` — Tailwind's default palette, shadows, radii and text sizes are
removed, so only TensorLM tokens exist (`bg-paper`, `text-ink`, `rounded-sm`, `shadow-2`,
`text-h2`, `duration-(--dur-fast) ease-out`). Preview them at `/dev/tokens` (dev only).

## Components

- `apps/web/src/components/ui/<name>.tsx` — one family per file, named exports, Radix primitives,
  `cn()` from `@/lib/utils`, variants via `cva`. Showcase: `/dev/components` (dev only), sections in
  `src/app/dev/components/sections/`.
- `hover:`, `active:` and `focus-visible:` also match `data-force="hover|pressed|focus"` (custom
  variants in `globals.css`), so the showcase renders every state statically. Real hover/press
  skip disabled controls.
- Overlays portal through `usePortalContainer()`, so menus/dialogs opened inside a `.dark` region
  stay dark.
- Component tests are `*.test.tsx` (jsdom, Testing Library, `expectNoAxeViolations` from
  `src/test/axe.ts`); unit tests are `*.test.ts` (node). Render with `renderUI` from `src/test/render`.
- `npm run shots:components` — per-section screenshots at 1440/1024/768/390, light and dark.

## Commands

Web (`cd apps/web`):

- `npm run dev` — dev server on <http://localhost:3000>
- `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`
- `npm run format` · `npm run format:check`
- `npm run shots -- <route> <outDir> [widths]` — full-page screenshots in light and dark (needs
  `npm run dev`; uses local Edge/Chrome). `npm run shots:tokens` for `/dev/tokens`.

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

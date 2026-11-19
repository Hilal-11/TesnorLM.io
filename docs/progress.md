# Progress log

Append-only. One entry per finished task: date, task id, 2–3 lines on what changed and anything notable.

## 2026-11-19 — P1 web scripts (typecheck, Vitest, Prettier)

- Added `typecheck`, `test`, `test:watch`, `format`, `format:check`; Vitest 5 + Vite 8 (native tsconfig paths,
  no `vite-tsconfig-paths`), Prettier + Tailwind plugin; codebase formatted once; 4 tests for `formatContext`.
- `retrieval.ts` creates the OpenAI client lazily. `npm test` runs via `scripts/vitest.mjs` to dodge a Vitest
  bug with lowercase `c:\` cwd on Windows. Added `apps/web/.npmrc` (strict peer deps, overrides user
  `legacy-peer-deps=true`) and root `.gitattributes` (LF everywhere).

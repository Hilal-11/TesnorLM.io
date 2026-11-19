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

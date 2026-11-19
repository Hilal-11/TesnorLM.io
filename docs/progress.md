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

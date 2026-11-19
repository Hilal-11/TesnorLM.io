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

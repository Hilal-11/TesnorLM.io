# TensorLM v2 — Part B: Phases 5 and 6 (notes, quality, depth and trust)

Start this only after Part A (docs/plans/TensorLM-v2-Part-A-Phases-3-4.md) is complete and its verification reports show zero FAIL. Part A contains the full change list (Part 0) and product flow (Part 1); the key points for this half are below.

> Repo notes (added when this file was filed, 2026-11-20):
> - A `notes` table already exists from v1 (migration 0005: `notebook_id NOT NULL ... on delete
>   cascade`, `quote`, `body`, `page`, `document_id`, `chat_id`, `message_id`, soft delete). The v1
>   PDF selection toolbar's "Save note" writes to it. P5.1 must therefore be a NEW migration that
>   alters this table (nullable `notebook_id` with `on delete set null` for Unfiled, editor JSON
>   `content`, `content_text`, `source_refs`, tags, pin, archive, versions, search) and migrates
>   existing rows, never a fresh `create table`.
> - P3.14v2 (notebook delete moves notes to "Unfiled") depends on that nullable `notebook_id`;
>   until P5.1 lands, deleting a notebook still cascades to its notes.
> - Phase-3-Verification-Checklist.md is not in this repository; the audit rules are the ones
>   summarised in Part 10 below.

## Part 0 — What this half delivers

- **Notes on their own page (/notes)**: full-page rich editor, no popups, autosave, all note operations, version history, trash, and AI actions you accept or discard. Answers and passages save into notes with working citations.
- **Quality and depth**: a 50-question eval suite, tracing and cost tracking, a reranker, deep explanations and study guides only when asked, runnable Python in the browser, and interactive visuals.
- **Trust**: confirmation dialogs for every destructive action, colours by action (red for delete and sign out, green for success, amber for caution), errors with a reason and a fix.

No new external accounts are needed for this half. Everything from Part A (Supabase, Inngest, Railway, Langfuse, Upstash, Anthropic, OpenAI) is reused. Phase 6 may add a reranker key (for example Cohere) and Sentry; Claude will ask when it gets there.

## Part 2 — Updated backlog (Phases 5 and 6)

Paste into docs/backlog.md, replacing these phases.

```markdown
## Phase 5 — Notes (new)
Milestone: notes live on their own page with a rich editor, autosave and every common operation; answers and
passages save into notes with working citations.
- [ ] Notes schema, versions, trash, RLS
- [ ] /notes workspace: list, filters, search, full-page editor (no popups)
- [ ] Editor: rich text, checklists, code, math, diagrams, tables, images, citation chips, slash and bubble menus
- [ ] Operations: create, rename, duplicate, pin, tag, move, archive, delete (confirm), trash, export, version history
- [ ] Integrations: save answer to note, add passage to note, turn note into source, notes panel in notebook
- [ ] AI in notes: summarise, rewrite clearer, explain selection, continue writing (accept/discard)
- [ ] Notes quality gate (tests, a11y, performance)

## Phase 6 — Quality, depth and trust
Milestone: measured answer quality with a 50-question eval suite, full tracing, reranking, on-demand deep
explanations, runnable code examples and interactive visuals; trust-focused UI pass complete.
- [ ] Eval suite (50 questions, all source types) + promptfoo + baseline and CI gate
- [ ] Observability: Langfuse traces (metadata only), Sentry, cost dashboard
- [ ] Reranker (20 → 8) with measured improvement
- [ ] On-demand deep explanations and study guides (only when asked), saved as notes
- [ ] Runnable code: Python in a browser sandbox (Pyodide) with Run, output, timeouts
- [ ] Interactive visuals: attention heatmap, matrix-multiplication stepper, formula sliders (declarative specs only)
- [ ] Trust UI pass: confirmations, action colours, error and empty states, microcopy audit
- [ ] Phase 6 verification report
```

## Part 4 — Master loop prompt (run the whole plan until everything passes)

Paste this once per phase (change PHASE). It keeps looping until every task and the phase's verification pass.

```text
MASTER LOOP — TensorLM PHASE <5|6> (v2)

Source of truth, in this order: (1) docs/plans/TensorLM-v2-Part-B-Phases-5-6.md, (2) docs/specs/*, contracts/*,
(3) .claude/skills/tensorlm-design/SKILL.md (amended in task S0), (4) CLAUDE.md. Where an older prompt file
is referenced, apply it together with the v2 changes; v2 wins on conflicts.

LOOP
1. Read docs/backlog.md and docs/progress.md. Find the first unticked task in PHASE.
2. Load that task's prompt from docs/plans/TensorLM-v2-Part-B-Phases-5-6.md (and the referenced older prompt if any). Write a short plan.
3. Build in small steps. After each step run the checks:
   web: npm run lint && npm run typecheck && npm test && npm run build
   e2e when UI changed: npm run e2e     · worker: pytest     · schema changes: npm run test:rls
   prompts/retrieval changes: npm run eval:smoke (Phase 4+)
4. Fix failures and re-run. Max 5 attempts on the same error; then write the blocker in docs/progress.md,
   mark the task BLOCKED in the backlog line, and move to the next task.
5. UI tasks: screenshots at 1440, 1024, 390 in light and dark → critique against the design skill checklist
   (section 13) and Part 0 rules (confirmations, action colours) → fix → remove one accessory.
6. When the task's "Done when" passes: tick it, add 2–4 lines to docs/progress.md, commit
   "<type>(<area>): <task>", open or update the PR, read CodeRabbit comments (gh pr view --comments),
   fix valid ones, reply to the rest, re-run checks.
7. Repeat from step 1 until every task in PHASE is ticked or BLOCKED.
8. Run the PHASE verification checklist (Part 10 of this file) as an AUDITOR: evidence for every item,
   report in docs/reports/phase-<n>-verification.md. For every FAIL, add a fix task to the backlog under PHASE
   and go back to step 1. Repeat until the verification report has zero FAIL (BLOCKED items listed for me).
9. Stop and summarise: what was built, report path, BLOCKED items with exactly what I need to do.

ALWAYS
- Stop and ask me for anything involving dashboards, keys, billing, OAuth, licences or production data.
- Never touch .env files' contents, never push to main, never run destructive tests on the main Supabase project.
- Never log document text, prompts, answers, passwords or keys.
```

Whole-phase goal alternative (Claude Code `/goal`):
```text
/goal docs/reports/phase-<n>-verification.md exists and shows zero FAIL for PHASE <n> (5 or 6) of docs/plans/TensorLM-v2-Part-B-Phases-5-6.md,
every PHASE <n> task in docs/backlog.md is ticked or BLOCKED with a reason, and all checks (lint, typecheck,
test, build, e2e, pytest, test:rls, eval:smoke where applicable) pass. Follow the MASTER LOOP rules. Or stop
after 150 turns.
```

---

## Part 5 — Shared rules for every v2 task (paste with each task prompt)

```text
SHARED RULES (TensorLM v2)
UI and trust
- Design tokens, fonts, motion and micro-interactions from the design skill. Learner words. Sentence case.
- Destructive actions ALWAYS confirm in a dialog: title names the action and the thing ("Delete
  "Transformers notes"?"), body states the consequence ("This deletes 3 sources and 12 notes. You can't undo
  this."), buttons "Cancel" (secondary, focused by default) and the action in danger red ("Delete notebook").
  High-impact deletes (notebook with sources) also require typing the name.
- Action colours: danger red = delete, remove, sign out, disconnect, discard, clear; success green = saved,
  added, ready, done; warning amber = caution, low confidence, partial; cobalt = primary actions and
  "you are here". Status is always icon + word + colour.
- Every state designed: empty, loading (skeleton after 300 ms), progress, partial, success, error (reason + fix).
- Keyboard and screen reader support for everything; reduced motion respected; ≥ 44 px touch targets.
Engineering
- requireUser + ownership + zod + withErrorHandling on every route/action; RLS + tests/rls coverage on every table.
- Stage names, source types and error codes only from contracts; prompts only in src/prompts or worker prompts;
  models only via models.ts / settings.
- Idempotent worker steps keyed by document_id + run_id; ready only via finalize functions; honest progress.
- Never log content, prompts, answers, passwords or keys.
```

---

## Part 8 — Phase 5 task prompts (Notes)

### P5.1 — Notes schema

```text
TASK: Migration for notes.
- notes: id, user_id, notebook_id nullable (null = Unfiled), title text not null default 'Untitled note',
  content jsonb (editor JSON), content_text text (plain text for search), source_refs jsonb (citations kept from
  answers/passages: document_id, chunk_id, page, start_seconds, quote_preview), tags text[] default '{}',
  pinned bool default false, archived_at, deleted_at (trash), word_count int, created_at, updated_at, version int.
- note_versions: id, note_id, user_id, content jsonb, title, created_at (snapshot at most every 5 minutes of
  editing and on demand; keep the last 50).
- Full-text search: generated tsvector on title + content_text, GIN index; trigram index on title for fuzzy search.
- RLS own rows; extend tests/rls; trash auto-purge after 30 days (scheduled job).
DONE WHEN: migration applied (TEST then main), types regenerated, RLS green.
```

### P5.2 — /notes workspace (no popups)

```text
TASK: The notes page.
- Routes: /notes (list + empty state), /notes/[id] (list + editor), /notes/new (creates a note immediately and
  redirects to /notes/[id] with the title focused — no dialog).
- Layout: left list pane (320 px, resizable): search ("Search notes", Ctrl/⌘ K inside notes), filters (Notebook,
  Tag, Pinned, Archived, Trash), sort (Last edited, Created, Title); note rows show title, first line, notebook
  colour dot + name, tags, relative time; pinned section on top. Centre: full-page editor (max 760 px reading
  width). Right (toggle): info panel — outline (headings), sources cited (clickable), backlinks (notes that link
  here), details (words, created, edited).
- Entry points: sidebar "Notes", notebook sources pane "Notes" tab (lists that notebook's notes; opening goes to
  /notes/[id]?from=<notebook> with a "Back to notebook" button).
- Empty states: "No notes yet" + "New note"; trash empty: "Trash is empty".
- Mobile: list view → tap → full-screen editor with back button.
DONE WHEN: create/open/navigate notes entirely without dialogs; keyboard and screen reader friendly.
```

### P5.3 — Editor

```text
TASK: Rich editor with Tiptap (check current Tiptap docs and licences; use only open-source extensions or confirm
with me before any paid one).
- Blocks: paragraph, H1–H3, bullet/numbered/check lists, quote, code block (syntax highlight, language select,
  copy), inline code, bold/italic/underline/strike/highlight (marker colour only for source quotes), links,
  tables, horizontal rule, images (from figures or upload), KaTeX math (inline and block, click to edit),
  Mermaid diagram block (edit code, live preview), citation chip node (non-editable, opens source in a notebook
  canvas), callouts (Note, Important, Key idea).
- Slash menu "/" for blocks; bubble menu on selection (bold, italic, link, highlight, AI); Markdown shortcuts
  (#, -, [ ], ```, $$); drag handle to move blocks; keyboard shortcuts listed in a help popover.
- Title field above the editor (Enter moves to body).
- Autosave: debounced 800 ms + on blur; status in the header "Saving…" → "Saved" (success colour, icon + word);
  offline: keep a local draft and show "Offline · saved on this device"; conflict (edited in two tabs): newest
  wins with a version snapshot of the other.
- Undo/redo, word count, focus mode (hide panes, Esc exits), print-friendly styles.
- Performance: large notes (20k words) stay responsive.
DONE WHEN: every block works by keyboard and mouse; autosave reliable (tests for debounce, offline, conflict).
```

### P5.4 — Note operations

```text
TASK: All the operations, consistently.
- Note menu (header "⋯" and list row menu): Rename, Duplicate, Pin/Unpin, Add tags, Move to notebook (combobox),
  Copy link, Export (Markdown, PDF, copy as Markdown), Version history, Archive, Delete (red).
- Delete → confirmation dialog: "Move "Attention notes" to trash?" / "You can restore it from Trash for 30 days."
  → red "Move to trash". In Trash: Restore (success toast), Delete forever (red, confirm: "Delete forever? You
  can't undo this."), Empty trash (red, typed confirmation when > 10 notes).
- Bulk operations in the list (checkbox selection): move, tag, pin, archive, trash — with one summary dialog for
  destructive ones.
- Version history side sheet: list of snapshots with time and word count, preview, "Restore this version"
  (creates a new snapshot of the current state first).
- Toasts confirm every operation with the matching verb ("Note duplicated", "Moved to Transformers").
DONE WHEN: every operation works from the menu, list and keyboard, with tests and correct colours/confirmations.
```

### P5.5 — Integrations with chat and sources

```text
TASK: Connect notes to the rest of TensorLM.
- Save answer to note (chat action): menu "New note" or "Add to existing note…" (searchable list) → content
  inserted with formatting, diagrams (as Mermaid blocks), code, math and citation chips; toast "Saved to
  <note title>" with "Open".
- Add passage to note (selection toolbar): appends a quote block with citation chip (page/timestamp) to the
  chosen note.
- Turn note into source: note menu "Add to sources" → creates a pasted_text source in the note's notebook (it
  becomes citable).
- Notebook "Notes" tab lists notebook notes; "New note" there creates a note linked to the notebook and opens it.
- Enable the Phase 4 feature flags for these actions.
DONE WHEN: e2e: ask → save answer → open note → click citation → source opens at the passage.
```

### P5.6 — AI in notes

```text
TASK: Helpful AI inside the editor (only on request).
- Bubble-menu "AI" and slash "/ai": Summarise selection, Rewrite clearer, Explain this (uses the note's notebook
  sources when available, cites them), Make a checklist, Continue writing.
- Result streams into a preview block under the selection with "Accept" (inserts/replaces), "Try again",
  "Discard" (red text button); nothing changes until Accept.
- Uses the chat route's pipeline (grounded when the note belongs to a notebook with sources); respects level.
DONE WHEN: each AI action works, never edits without Accept, and is traced with cost.
```

### P5.7 — Notes quality gate

```text
TASK: Tests (unit, e2e, autosave/offline/conflict, RLS), axe zero serious issues, keyboard-only run, performance
(20k-word note typing latency < 50 ms per keystroke), screenshots, and docs/reports/phase-5-verification.md.
```

---

## Part 9 — Phase 6 task prompts (Quality, depth and trust)

```text
P6.1 Eval suite: 50 questions across PDF, DOCX, web, transcript, dataset sources, general and small talk;
     promptfoo config; metrics: retrieval hit rate, faithfulness, citation accuracy, refusal correctness,
     visual validity, suggestion quality; baseline in docs/progress.md; CI job fails on > 2-point drops.
P6.2 Observability: Langfuse traces (metadata only) for chat, insights, captions, notes AI; Sentry for web and
     worker; a simple /admin/costs page (admin only) with cost per user/day and per feature.
P6.3 Reranker (Cohere Rerank or BGE): 20 → 8 chunks; enable only if eval improves; record before/after.
P6.4 On-demand deep explanations: "Explain deeply" and "Make a study guide on <topic>" (composer commands and
     message action). Planner → section writer streaming (reuse the old Phase 6 lesson design), saved as a note in
     /notes with citations. NEVER generated automatically.
P6.5 Runnable code: Python blocks get "Run" → executes in Pyodide inside a Web Worker (no network, 10 s timeout,
     memory guard, numpy available), output panel with stdout/plots; worked examples use it to compute numbers.
P6.6 Interactive visuals (declarative specs only): attention heatmap (hover token → weights), matrix
     multiplication stepper, formula explorer with sliders (e.g. softmax temperature), each with text alternatives
     and reduced-motion behaviour.
P6.7 Trust UI pass: audit every destructive action (confirmation + red), every success (green, icon + word), every
     error (reason + fix), every empty state (one action), sign out (red, confirm), microcopy against the banned
     list; fix all findings.
P6.8 Phase 6 verification report.
```

---

## Part 10 — Verification checklists (the master loop's audit step)

Each phase's audit follows these rules: evidence for every item, PASS/FAIL/PARTIAL/BLOCKED, report in
docs/reports/, fix plan, no fixing during the audit.

### Phase 5 must-pass items
- [ ] /notes/new opens a note without any dialog; autosave shows Saving → Saved
- [ ] All blocks work (lists, checklists, code, math, Mermaid, tables, images, citations, callouts)
- [ ] Operations: rename, duplicate, pin, tag, move, archive, trash (confirm), restore, delete forever (confirm),
      export Markdown/PDF, version restore
- [ ] Save answer to note keeps diagrams, code, math and working citations
- [ ] AI actions never change text without Accept
- [ ] Offline draft and two-tab conflict handled; RLS green; axe zero serious

### Phase 6 must-pass items
- [ ] 50-question eval suite runs in CI with baseline and drop detection
- [ ] Reranker decision backed by numbers
- [ ] Deep explanations only on request and saved as notes
- [ ] Python "Run" works offline in the browser with timeout; interactive visuals accessible
- [ ] Trust UI audit shows zero unconfirmed destructive actions and zero errors without a fix

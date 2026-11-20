# TensorLM v2 — Part A: Phases 3 and 4 (sources, ingestion and chat in the main shell)

This file replaces the earlier Phase 3 and Phase 4 prompt files wherever they disagree. Where a task says "reuse P3.x from Phase-3-Loop-Prompts.md" (or P4.x from Phase-4-Loop-Prompts.md), give Claude that older prompt together with the changes written here.

> Repo note: the older prompt files (Phase-3-Loop-Prompts.md, Phase-4-Loop-Prompts.md,
> Phase-3-Verification-Checklist.md) are not in this repository. Their v1 tasks are already built
> (see docs/progress.md and docs/specs/*), so "reuse P3.x" means "extend what P3.x built".

Part B (Phases 5 and 6: notes, quality and depth) is in TensorLM-v2-Part-B-Phases-5-6.md. Finish Part A first.

## Part 0 — What changed and why

| # | Your request | What it means for the product | Where |
|---|---|---|---|
| 1 | Accept all PDFs, don't reject | Every PDF is accepted and the worker tries everything before giving up: repair damaged files, open files with permission locks automatically, ask for the password on password-locked files, OCR scans, read huge files in batches. Only a file that is truly unreadable after all of that ends in "Couldn't read", with the reason and next step. | Phase 3 |
| 2 | Upload from the main shell (Home), many source types | Home **is** the workspace. A new "Untitled notebook" is created the moment you add a source or ask a question. One "Add sources" dialog: upload files (PDF, Word, PowerPoint, Excel, CSV, JSON, images, text, Markdown), websites, YouTube, Google Drive, copied text, and web search. | Phase 3 |
| 3 | Fast processing in the main shell | **Two-pass ingestion**: a fast first pass makes text searchable within seconds ("Ready to ask"), then a deep pass adds tables, figures and layout in the background ("Improving tables and figures") and swaps in atomically. | Phase 3 |
| 4 | Advanced chat box at the bottom; chat with Claude about anything | The composer is always at the bottom of the main shell. Works with **no sources** (general chat), for **small talk** ("hi" gets a quick, natural reply), and **grounded** on sources with citations. | Phase 4 |
| 5 | Read the uploads, suggest 5 questions, don't explain the whole PDF unasked | After sources are ready, TensorLM writes a 2–3 sentence overview and **5 clickable suggested questions**. It never auto-explains the whole document. Deep explanations happen only when asked. | Phases 3, 4, 6 |
| 6 | Diagrams, code examples, visualisations of the asked concept | Answers can include self-drawing diagrams, charts, matrix/heatmap views, tensor-shape views, step-by-step visuals, comparison tables and code blocks; runnable Python and interactive visuals come in Phase 6. | Phases 4, 6 |
| 7 | Confirmation popups for destructive actions; colour by operation | Deleting or signing out asks first, in a confirmation dialog with a red action button that names the thing and the consequence. Red for delete, remove, sign out, disconnect; green for success; amber for caution. **This overrides the design skill's "prefer Undo" rule**; your skill says the user's brief wins, and a task below updates the skill file so future work stays consistent. | All phases |
| 8 | Notes on their own page, no popup | A full **/notes** workspace with a rich editor (headings, checklists, code, math, diagrams, tables, citations), autosave, search, tags, pin, move, duplicate, export, version history, trash, and AI actions. Answers and PDF passages can be saved into notes with their citations. | Phase 5 (new) |
| 9 | Review Phases 5–6 | Old Phase 5 (evals) and Phase 6 (auto lessons) are merged into a new Phase 6, "Quality, depth and trust". Auto-generated lessons are replaced by **on-demand** deep explanations and study guides, plus runnable code and interactive visuals. | Phase 6 |

**What "accept all PDFs" can and can't mean.** Some PDFs can only be read if the user types the password, and a
completely blank or destroyed file has nothing to read. Those are the only cases that end without text, and
even then the file stays in the notebook with a clear reason and a next step. Nothing is rejected at upload.

**One licence warning.** Don't use PyMuPDF (fitz) for the fast pass. It's AGPL-licensed, which creates
obligations for a closed-source web service. Use **pypdfium2** (permissive licence) for fast text extraction
and rendering.

---

## Part 1 — The new product flow (for the spec)

```
Home (/app)  ── is ──▶  Main shell with an empty "Untitled notebook" (created lazily)
   │
   ├─ Composer at the bottom: "Ask a question or create something"   · 0 sources ·  [send]
   │     └─ with no sources: general chat with Claude (small talk, explanations, code)
   │
   ├─ "Add sources" (button, Ctrl/⌘ U, drag anywhere, paste)
   │     ├─ Search the web (Fast research) → pick results → import
   │     ├─ Upload files: PDF, Word, PowerPoint, Excel, CSV, JSON, images, text, Markdown
   │     ├─ Websites & YouTube links (one per line)
   │     ├─ Google Drive (Docs, Sheets, Slides, PDFs)
   │     └─ Copied text
   │
   ├─ Each source: Uploading → Reading → Ready to ask (fast pass) → Improving tables and figures → Ready
   │
   ├─ When sources are ready: overview (2–3 sentences) + 5 suggested questions (clickable chips)
   │
   ├─ Ask → streamed answer at your level, citations [1] open the exact passage (marker highlight),
   │        diagrams draw themselves, code blocks, charts, matrices; "Not from your sources" when general
   │
   └─ Save to note → /notes/[id] (full-page editor; citations stay clickable)

Library (/app/notebooks): grid · list · board of all notebooks.
Notes (/notes): all notes, full-page editor.
```

The URL changes from `/app` to `/app/n/[id]` when the notebook is created, **without** a page reload or a
visible jump (shallow routing).

---

## Part 2 — Updated backlog (Phases 3 and 4)

Paste into docs/backlog.md, replacing these phases.

```markdown
## Phase 3 — Sources & ingestion in the main shell (v2)
Milestone: from Home, add any supported source (files, web, YouTube, Drive, text, web search); every PDF is
accepted; text is askable within seconds (fast pass) and fully enriched later (deep pass); an overview and
5 suggested questions appear; 5 uploads at once all finish.
- [ ] Product spec v2, contracts v2 and design-skill amendment (confirmations, action colours)
- [ ] DB v2: source types, new stages, needs_password, datasets, notebook insights, notebook auto-title
- [ ] Notebooks data layer + Library page (grid, list, board) with confirmation dialogs
- [ ] Main shell: Home = lazy "Untitled notebook" workspace; sidebar notebooks; shallow URL change
- [ ] Add sources dialog: upload files, websites & YouTube, Google Drive, copied text, web search
- [ ] Upload pipeline v2: resumable uploads for every file type, sniffing, quotas (no rejection by type)
- [ ] Queue (Inngest): ingestion functions per source type, fast pass priority, retries, concurrency, cancel
- [ ] Accept-all PDF handling: repair, permission locks, password prompt, disguised files, scans, huge files
- [ ] Two-pass ingestion: fast pass (seconds) + deep pass (Docling) with atomic swap
- [ ] OCR fallback with honest status
- [ ] Page-aware chunking + embeddings
- [ ] Figures + captions as searchable chunks
- [ ] Other formats: DOCX, PPTX, HTML, Markdown, TXT, images, CSV, Excel, JSON (datasets)
- [ ] Web pages, YouTube transcripts, Google Drive files, copied text, web search import
- [ ] Notebook guide: auto title, overview, 5 suggested questions, per-source summary
- [ ] Live progress UI in the sources pane (Realtime + polling fallback)
- [ ] Remove, reprocess and delete with confirmation dialogs and full cleanup
- [ ] Tests (all formats), load test (5 and 10 at once), hardening, deploy

## Phase 4 — Chat in the main shell (v2)
Milestone: in the main shell, small talk gets a natural reply, general questions work without sources, and a
question about the Transformer paper gets a streamed, cited answer with a self-drawing diagram, code or visual
when useful, at the chosen level.
- [ ] Answer spec v2 + contract (modes, visual blocks, thinking, suggestions)
- [ ] DB: chats, messages, feedback, source selection
- [ ] Workspace panes in the main shell: Sources · Conversation · Canvas (Diagram, Source); mobile tabs
- [ ] Sources pane: selection, figures, per-source summary, "N sources" in composer
- [ ] Chats persistence, chat switcher, new chat, auto titles
- [ ] Pipeline: intent (small talk, general, grounded), rewrite, adaptive routing, numbered context
- [ ] Chat route v2: streaming, levels, optional thinking, prompt caching, tracing, rate limits, stop/continue
- [ ] Validated citations
- [ ] Renderer v2 with visual blocks (diagram, chart, matrix, tensor shape, steps, compare, timeline) and code
- [ ] Self-drawing diagrams + Mermaid repair
- [ ] Chat UI: states, actions, follow-ups, feedback, "Thinking" collapsible
- [ ] Advanced composer: N sources, settings (level, length, visuals, thinking), attach, /, @, voice, drafts
- [ ] Citation chips + previews
- [ ] Source viewers: PDF (highlights), web page reader, YouTube transcript (timestamps), dataset table, documents
- [ ] Selection toolbar (Explain, Simplify, Diagram, Add to note, Copy)
- [ ] Quality gate: smoke evals (grounded, general, small talk, suggestions, formats), performance, a11y, security
```

## Part 3 — External requirements (you do these)

Already from earlier: Supabase (main + test project), Inngest, Railway (≥ 4 GB RAM), Langfuse, Upstash Redis,
Anthropic and OpenAI keys with spend caps.

**New:**

1. **Google Drive import (Google Picker)** in your existing Google Cloud project:
   - APIs & Services → **Enable** "Google Drive API" and "Google Picker API".
   - **Credentials → Create API key** → restrict it to HTTP referrers `http://localhost:3000/*` and
     `https://tensorlm.io/*` and to the Picker API.
   - **OAuth client**: use a Web client (can be the same one as sign-in, or a separate one). Add JavaScript
     origins `http://localhost:3000` and `https://tensorlm.io`.
   - **OAuth consent screen → Data access/Scopes**: add `https://www.googleapis.com/auth/drive.file` (access only
     to files the user picks — the least access). Check Google's current verification requirements before launch.
   - Note the **project number** (the Picker "app id").
   - `.env`: `NEXT_PUBLIC_GOOGLE_API_KEY=…`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID=…`, `NEXT_PUBLIC_GOOGLE_APP_ID=<project number>`
2. **Web search for "Search the web"**: create an account with one search API (for example **Tavily**, which is
   built for AI apps; Exa or Brave Search API also work). `.env`: `WEB_SEARCH_PROVIDER=tavily`, `TAVILY_API_KEY=…`
3. **YouTube transcripts**: free unofficial transcript libraries often break or get blocked from cloud servers.
   Choose one: (a) start with the free library and accept failures (users can paste the transcript), or
   (b) use a paid transcript API for reliability. `.env`: `YOUTUBE_TRANSCRIPT_PROVIDER=library` (or the paid one + key).
4. **File size above 50 MB**: Supabase's free plan caps each upload at 50 MB. To accept larger files, upgrade to
   Supabase Pro and raise the global and bucket limits, then set `MAX_UPLOAD_MB` to match.
   `.env`: `MAX_UPLOAD_MB=50` (or your new limit), `MAX_PAGES=2000`, `FAST_PASS_PAGE_BATCH=50`
5. **Voice input** (optional): uses the browser's built-in speech recognition. Nothing to set up.
6. Copy `.env` to `apps/web/.env.local`; add the same keys to Vercel and Railway when deploying.

---

## Part 4 — Master loop prompt (run the whole plan until everything passes)

Paste this once per phase (change PHASE). It keeps looping until every task and the phase's verification pass.

```text
MASTER LOOP — TensorLM PHASE <3|4> (v2)

Source of truth, in this order: (1) docs/plans/TensorLM-v2-Part-A-Phases-3-4.md, (2) docs/specs/*, contracts/*,
(3) .claude/skills/tensorlm-design/SKILL.md (amended in task S0), (4) CLAUDE.md. Where an older prompt file
is referenced, apply it together with the v2 changes; v2 wins on conflicts.

LOOP
1. Read docs/backlog.md and docs/progress.md. Find the first unticked task in PHASE.
2. Load that task's prompt from docs/plans/TensorLM-v2-Part-A-Phases-3-4.md (and the referenced older prompt if any). Write a short plan.
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
/goal docs/reports/phase-<n>-verification.md exists and shows zero FAIL for PHASE <n> (3 or 4) of docs/plans/TensorLM-v2-Part-A-Phases-3-4.md,
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

## Part 6 — Phase 3 v2 task prompts (Sources & ingestion in the main shell)

### S0 — Spec v2, contracts v2, design-skill amendment

```text
TASK: Update the product decisions before code.
1. docs/specs/product-flow.md: Part 0 and Part 1 of this file in your words (main shell, lazy notebook,
   add sources dialog, two-pass ingestion, suggestions, general chat, notes page, confirmations, action colours).
2. Update docs/specs/ingestion.md and contracts/ingestion.json to v2:
   - source_types: pdf, docx, pptx, xlsx, csv, json, image, text, markdown, html, web, youtube, gdrive, pasted_text
   - stages: uploading, queued, validating, repairing, needs_password, parsing_fast, fast_ready, ocr, parsing_deep,
     reading_figures, indexing, ready, failed
   - uiWords: Uploading, Queued, Reading, Repairing file, Needs password, Reading, Ready to ask, Running OCR,
     Improving, Reading figures, Indexing, Ready, Couldn't read
   - errors (only after every fallback fails): password_wrong (retry), unreadable_after_repair, no_text_after_ocr,
     source_unreachable (web/YouTube/Drive), transcript_unavailable, file_too_large (plan limit, with upgrade path),
     quota_exceeded, upload_interrupted, internal — each with message + fix
   - remove not_pdf/encrypted_pdf/corrupt_pdf/too_many_pages as terminal rejections (they become routing,
     password and repair paths)
   - TS + Python loaders and cross-language tests updated.
3. Design-skill amendment: propose an edit to .claude/skills/tensorlm-design/SKILL.md section 8.4 replacing
   "prefer Undo over confirmation" with the confirmation rules and action colours from SHARED RULES, and add a
   line to section 14 (log) explaining the change ("Hilal's brief: confirmations increase trust"). SHOW ME the
   diff and wait for my OK before writing it.
DONE WHEN: specs + contracts v2 committed with passing tests, skill amendment approved and applied.
```

### P3.1v2 — Database v2

```text
TASK: Migration for v2 (if the earlier Phase 3 migration is already applied, write a NEW migration that
alters it; never edit applied migrations). Start from P3.1 in Phase-3-Loop-Prompts.md, plus:
- documents → keep the table name (or rename to sources with a compatibility view; choose and document);
  add source_type enum, mime_type, origin_url, origin_meta jsonb (youtube id, drive file id, page title),
  display_name, needs_password bool, repaired bool, fast_ready_at timestamptz, deep_ready_at timestamptz,
  summary text, summary_generated_at; stage enum per contract v2.
- datasets: id, document_id, user_id, sheet_name, row_count, column_count, columns jsonb (name, type, null %,
  example values, stats), storage_path of a normalised Parquet/CSV copy, created_at. RLS.
- notebooks: title_generated bool, overview text, suggested_questions jsonb (5 items: text, why, source ids),
  insights_sources_hash text, insights_generated_at.
- chunks.kind adds 'transcript' (with start_seconds, end_seconds columns) and 'dataset' and 'web'.
- functions: finalize_fast_pass(doc, run) (makes text askable; stage fast_ready) and finalize_ingest(doc, run)
  (atomic swap to deep run; stage ready) — both service-role only; set_document_stage updated for v2 transitions.
- password handling: NO password column ever. Passwords are kept only in Redis (see P3.8v2).
- Realtime publication includes documents and notebooks (for overview/suggestion updates).
Apply to TEST → test:rls (extend coverage) → main → db:types.
DONE WHEN: schema v2 live, types regenerated, RLS green.
```

### P3.2v2 — Notebooks data layer + Library page

```text
TASK: Reuse P3.2, P3.3 and P3.4 from Phase-3-Loop-Prompts.md (data layer, grid/list, board), with v2 changes:
- Library lives at /app/notebooks ("Library" in the sidebar); Home is the main shell (P3.3v2).
- Delete notebook: confirmation dialog per SHARED RULES (type the name when it has sources); no Undo toast.
  Bulk delete: one dialog summarising counts.
- Card menus: destructive items in red at the bottom, separated.
- Notebook titles can be AI-generated (title_generated = true shows a subtle "Suggested title" hint until the
  user renames).
DONE WHEN: the older Done-when checks pass with confirmations and action colours.
```

### P3.3v2 — Main shell (Home = workspace)

```text
TASK: Make Home the workspace.
- Routes: /app (new, empty workspace) and /app/n/[id] (existing notebook) render the SAME workspace component.
- Lazy notebook: /app shows the workspace with no notebook row yet. The first action that needs one (adding a
  source, sending a message) creates "Untitled notebook" and replaces the URL with /app/n/[id] via shallow
  routing (no reload, no flash, focus stays in the composer). Abandoned empty notebooks (no sources, no
  messages) are not created at all.
- Layout (skill 6.1): Sources pane (272 px) · Conversation (centre) · Canvas (opens on demand).
  Composer fixed at the bottom of the conversation column on every screen size.
- Empty main shell (no sources, no messages):
  · centre: greeting "What do you want to understand today?" (h2), a large "Add sources" card (dashed border,
    drop target, icons for Files · Web · YouTube · Drive · Text) and below it 3 example prompts for general chat
  · the composer works immediately for general chat ("0 sources")
- With sources: overview + 5 suggested questions at the top of an empty conversation (P3.14v2 data, P4 UI).
- Sidebar: "New notebook" (opens /app), "Library", "Notes", recent notebooks list (auto-title + colour dot).
- Header: editable notebook title (click to rename inline), source count, share (later), notebook menu
  (Rename, Change colour, Delete notebook — red, confirm).
DONE WHEN: e2e: open /app → type a question → notebook created, URL changes without reload, answer area ready;
open /app → drop a PDF → same; empty notebooks never persist; axe and screenshots pass.
```

### P3.4v2 — Add sources dialog

```text
TASK: One dialog for every source origin (reference: the NotebookLM-style screenshot Hilal shared, rendered in
TensorLM's design language — paper/sheet surfaces, Hanken, cobalt actions, no Google colours except provider logos).
- Opens from "Add sources" buttons, the sources pane, the composer's Attach, Ctrl/⌘ U, and the empty-state card.
- Title: "Add sources". Subtitle (graphite): "TensorLM reads them so you can ask questions, get diagrams and save notes."
- Search row: input "Search the web for sources" + Select "Web" (later: "Scholar") + Select "Fast research";
  submit → results list (title, site, snippet, type icon) with checkboxes → "Import 3 sources".
- Tiles (buttons with icons, 2 rows, keyboard navigable): Upload files · Website · YouTube · Google Drive ·
  Copied text.
  · Website / YouTube: textarea "Paste one or more links, one per line" with live validation per line
    (recognises YouTube vs web vs direct PDF link) → "Add 2 links"
  · Google Drive: opens the Google Picker (drive.file scope) for Docs, Sheets, Slides, PDFs, images; selected
    files are imported via the server with the user's short-lived token
  · Copied text: title (optional, AI fills it if empty) + large textarea → "Add text"
- Dropzone (bottom): "Drag and drop files, or browse" + supported types line: "PDF, Word, PowerPoint, Excel,
  CSV, JSON, images, text and Markdown". Accepts multiple files and folders (flatten).
- After adding, the dialog closes and the sources appear in the pane with live status (don't keep people waiting
  in a dialog). Errors per item show inline with a fix.
- Global drag-and-drop over the main shell and paste (files, images, links, text) use the same flows.
DONE WHEN: every origin adds a source row and triggers ingestion; keyboard-only flow works; axe passes;
screenshots at 1440 and 390.
```

### P3.5v2 — Upload pipeline for every file type

```text
TASK: Reuse P3.10 (resumable TUS uploads, progress, resume, duplicate detection) from Phase-3-Loop-Prompts.md,
changed for v2:
- No rejection by type in the browser: sniff magic bytes + extension and assign source_type; unknown binary
  types are still uploaded and then routed by the worker (unsupported → stays with a clear "TensorLM can't read
  this type yet" and a suggestion, never silently dropped).
- Size: the only hard limit is the storage plan limit (MAX_UPLOAD_MB). Over it: "This file is 120 MB. Your plan
  allows 50 MB per file. Split it, or upgrade for larger files." (upgrade link placeholder).
- No page-count rejection: pages are handled by batching in the worker (MAX_PAGES protects the service).
- Up to 50 files per batch; 3 parallel uploads; queue the rest.
- Images pasted from the clipboard become image sources.
DONE WHEN: every supported type uploads with real progress and resumes after a network drop (e2e).
```

### P3.6v2 — Queue

```text
TASK: Reuse P3.5 (Inngest) from Phase-3-Loop-Prompts.md, plus:
- Functions: ingest-file (all uploaded files), ingest-web, ingest-youtube, ingest-gdrive, ingest-text,
  generate-notebook-insights, cleanup jobs.
- Two priorities: fast pass steps run before deep pass steps across documents (use Inngest priority or
  separate functions with different concurrency: fast concurrency 4, deep concurrency 2 per deployment;
  per-user concurrency 2).
- Deep pass is a separate step chain triggered after fast_ready, cancellable on delete/reprocess.
DONE WHEN: 10 mixed sources at once all reach a terminal state; fast passes are not starved by deep passes.
```

### P3.7v2 — Accept-all PDF handling (preflight and repair)

```text
TASK: Make every PDF readable if it is at all possible.
Pipeline "validate" becomes "preflight" (worker):
1. Sniff: if the bytes are not a PDF, route by real type (e.g. a PNG renamed .pdf → image pipeline).
2. Open with pikepdf (or pypdfium2):
   - permission-locked PDFs (owner password only: printing/copying disabled) open without a password → continue.
   - user-password PDFs → stage needs_password; the UI asks for the password (P3.15v2). The password is sent once
     to POST /api/documents/[id]/password, stored ONLY in Redis with a 10-minute TTL keyed by document id, read
     once by the worker, deleted immediately, never logged, never in Inngest payloads. Wrong password →
     password_wrong with "Try again" (max 5 attempts, then wait 15 min).
   - damaged PDFs → stage repairing: try pikepdf/qpdf repair; if still broken, render pages to images with
     pypdfium2 and treat as scanned (OCR); if rendering fails page by page, keep the pages that work and note
     "3 pages couldn't be read" in the source detail.
3. Huge PDFs: no rejection; process in batches of FAST_PASS_PAGE_BATCH pages; MAX_PAGES caps service load
   (beyond it: read the first MAX_PAGES and say so clearly with a way to split).
4. Only when every path fails: unreadable_after_repair (keep the file, explain, offer "Try again" and
   "Upload a different copy").
Fixtures: owner-locked, user-password (known password), repairable-corrupt, unrepairable, renamed PNG, 300+ pages.
DONE WHEN: all fixtures end in the expected state (most of them Ready); passwords never appear in logs/DB/events.
```

### P3.8v2 — Two-pass ingestion (fast, then deep)

```text
TASK: Make sources askable in seconds and excellent minutes later.
Fast pass (PDFs with a text layer; target ≤ 10 s for a 30-page paper on the production worker):
- pypdfium2 text per page (NOT PyMuPDF — AGPL), simple heading detection from font size if available,
  paragraph chunking (~400 tokens) with page_start/page_end, embeddings, write with run_id "fast", then
  finalize_fast_pass → stage fast_ready ("Ready to ask") and trigger insights (P3.14v2).
- Scanned PDFs skip fast pass (no text) and go straight to OCR with honest status.
Deep pass (background):
- Docling with layout, tables, figures, OCR where needed (reuse P3.6–P3.9 from Phase-3-Loop-Prompts.md),
  HybridChunker with bboxes, captions, then finalize_ingest atomic swap from the fast run to the deep run →
  ready. UI line: "Ready to ask · improving tables and figures" → "Ready".
- Citations made during fast_ready still resolve after the swap: keep fast-run chunks referenced by saved
  messages (soft-retire instead of delete), or map them to deep chunks by page + text overlap. Choose,
  implement, test and document.
DONE WHEN: a 30-page text PDF is askable in ≤ 10 s locally (report timing), deep pass completes and swaps
without breaking existing citations.
```

### P3.9v2 — OCR, chunking, figures

```text
TASK: Reuse P3.7 (OCR), P3.8 (page-aware chunking + embeddings) and P3.9 (figures + captions) from
Phase-3-Loop-Prompts.md inside the deep pass, with batching for large documents and the v2 stage names.
DONE WHEN: the older Done-when checks pass inside the two-pass flow.
```

### P3.10v2 — Other file formats

```text
TASK: Read every supported file type.
- DOCX, PPTX, HTML, Markdown, TXT, AsciiDoc: Docling converters (check the current list of supported formats);
  PPTX chunks carry slide numbers (stored in page_start/page_end as slide numbers, labelled "slide" in UI).
- Images (PNG, JPG, WebP, HEIC → convert): OCR for text + vision description (FAST_MODEL) → chunks
  kind 'text'/'figure_caption'; the image itself viewable in the canvas.
- CSV / Excel (all sheets) / JSON: create datasets rows (schema, types, null %, stats, example values), a
  normalised copy in storage, and descriptive chunks (kind 'dataset'): one schema chunk per table + summary
  chunks for column groups + sampled rows; JSON: infer structure (records vs nested), flatten records, describe
  nesting. Never embed thousands of raw rows. Big files: stream-read.
- Each format gets fast-pass behaviour where sensible (text formats are fast already).
DONE WHEN: fixtures for every format end Ready with sensible chunks; dataset schema is correct for CSV, a
multi-sheet XLSX and nested JSON.
```

### P3.11v2 — Web pages, YouTube, Google Drive, copied text, web search

```text
TASK: Import sources that aren't files.
- Web page: server-side fetch with SSRF protection (resolve DNS, block private/loopback/link-local/metadata IPs,
  only http/https, max 10 MB, 15 s timeout, max 5 redirects re-checked each hop), respect robots where
  reasonable, extract main content (trafilatura or Readability), keep title/author/date, store a cleaned
  snapshot (HTML → Markdown) so answers stay stable; direct PDF links go to the PDF pipeline.
  Failure → source_unreachable: "We couldn't open this page (it may need a login). Paste the text instead."
- YouTube: video id from any URL form; transcript with timestamps via the chosen provider; chunks kind
  'transcript' with start/end seconds (citations show "12:34"); title + channel; failure →
  transcript_unavailable with "Paste the transcript instead".
- Google Drive: client gets a short-lived access token from Google (drive.file) via the Picker; the server
  downloads (Docs → export DOCX or PDF, Sheets → XLSX, Slides → PPTX/PDF, files as-is) using that token
  immediately; never store Google tokens.
- Copied text: stored as a text file in storage; title from user or fastModel.
- Web search (Fast research): server calls the search provider with the query, returns 8–10 results; imported
  results go through the web-page path; show the provider's attribution if required.
DONE WHEN: each origin works on real examples (I'll test Drive manually) and failures show the right fix.
```

### P3.12v2 — Notebook guide: title, overview, 5 suggested questions, source summaries

```text
TASK: Help people start asking without explaining everything unasked.
- Trigger generate-notebook-insights when a source reaches fast_ready or ready, or sources change (debounce 20 s;
  skip if insights_sources_hash unchanged).
- fastModel with a prompt in the worker or web prompts folder (choose one place):
  · notebook title (≤ 6 words, sentence case) only if title_generated is still true
  · overview: 2–3 sentences about what the sources cover (no claims beyond them)
  · exactly 5 suggested questions: varied (core idea, how it works, a key figure/table, comparison or
    limitation, practical application), ≤ 90 characters, each with the source ids it relies on
  · per-source summary: 1–2 sentences on each new source (documents.summary)
- Input: titles, headings, first chunks and figure captions (bounded tokens), never the whole document.
- Write via service role; Realtime pushes updates to the UI.
- NEVER produce a full explanation or lesson here.
DONE WHEN: after uploading the fixture paper, the notebook gets a title, an overview and 5 good questions within
seconds of fast_ready; regenerates when a source is added; cost per run logged.
```

### P3.13v2 — Live progress in the sources pane

```text
TASK: Reuse P3.11 from Phase-3-Loop-Prompts.md, inside the main shell's sources pane, with v2 states:
- Status lines: "Uploading · 62%", "Reading page 18 of 42", "Repairing file", "Needs password" (inline password
  field + "Unlock" button + "Remove"), "Ready to ask · improving tables and figures", "Running OCR on page 4 of
  12", "Ready", "Couldn't read" + reason + fix.
- Source types show their own icons (PDF, Word, PowerPoint, Excel, CSV, JSON, image, web, YouTube, Drive, text).
- Clicking a source opens its viewer in the canvas (P4 viewers) and shows its summary at the top.
DONE WHEN: every state appears live without refresh, including Realtime reconnects and the password flow.
```

### P3.14v2 — Remove, reprocess, delete with confirmations

```text
TASK: Reuse P3.12 from Phase-3-Loop-Prompts.md with confirmations instead of Undo:
- "Remove source" → dialog "Remove "attention.pdf"?" / "Answers will stop using it. Notes that quote it keep
  their text." → red "Remove source".
- Reprocess → no confirm (non-destructive); shows Queued → … again.
- Delete notebook → typed-name confirmation; summary of what will be deleted (sources, chats, notes in it —
  notes are moved to "Unfiled" unless the user ticks "Also delete notes").
- Cleanup jobs, cancellation and orphan sweepers as in the older prompt.
DONE WHEN: confirmations follow SHARED RULES; cleanup leaves no orphaned files or runs.
```

### P3.15v2 — Tests, load test, hardening, deploy

```text
TASK: Reuse P3.13 and P3.14 from Phase-3-Loop-Prompts.md, extended:
- Fixtures for every format and every PDF path (P3.7v2 list) + a web page fixture served locally + a recorded
  YouTube transcript fixture + CSV/XLSX/JSON fixtures.
- Load test: 5 then 10 mixed sources at once; report time to fast_ready and to ready (p50/p95).
- Security: SSRF tests (private IPs, redirects to private IPs, file:// URLs), password never logged/stored,
  Drive tokens never stored.
- Deploy worker with the extra Python deps (pikepdf, trafilatura, openpyxl/pandas, transcript lib) and models baked in.
DONE WHEN: all tests green, load test passes, production upload works end to end.
```

---

## Part 7 — Phase 4 v2 task prompts (Chat in the main shell)

Start from Phase-4-Loop-Prompts.md and apply these changes task by task.

### P4.0v2 — Answer spec v2

```text
TASK: P4.0 from Phase-4-Loop-Prompts.md, plus:
- Modes: small_talk (greetings, thanks, "who are you"), general (no sources selected or question unrelated to
  sources), grounded (sources selected and relevant), mixed (grounded + :::general passages).
- General mode shows ONE quiet line above the answer: "General answer · not from your sources" instead of
  tagging every paragraph; grounded/mixed mode tags only the general passages.
- Visual blocks contract (all declarative JSON or Mermaid, validated with zod; the model never sends code to run):
  mermaid (diagram), chart, matrix (rows × cols values, labels, optional heatmap), tensor_shape (named dimensions,
  e.g. batch × seq × d_model, with transformations), steps (numbered process with optional mini-visual per step),
  compare (2–4 columns table), timeline.
- Code blocks in any language with filename/language; Python marked runnable in Phase 6.
- Thinking: optional, only for complex intents; UI shows a collapsible "Thinking" summary (never raw chain of
  thought if the provider gives summaries; follow provider rules).
- Suggested questions: 5 at notebook start (P3.12v2), 3 follow-ups after each answer.
- Answers explain only what was asked. "Explain the whole paper" style requests are allowed when asked, but the
  app never does it unprompted.
```

### P4.1v2 — DB

```text
TASK: P4.1 from Phase-4-Loop-Prompts.md, but DO NOT create the notes table here (Phase 5 owns notes).
Add to messages: mode includes small_talk | general | grounded | mixed; reasoning_summary text (optional);
visual_blocks_count int. Everything else as written.
```

### P4.2v2 — Workspace panes in the main shell

```text
TASK: P4.2 from Phase-4-Loop-Prompts.md applied to the main shell from P3.3v2 (/app and /app/n/[id]).
Keep: Sources · Conversation · Canvas (tabs Diagram, Source), resizable, persisted, mobile tabs
"Sources · Chat · Source", composer always at the bottom.
```

### P4.3v2 — Sources pane

```text
TASK: P4.3 from Phase-4-Loop-Prompts.md, plus: per-source summary (documents.summary) in the source detail,
a "Notes" tab placeholder in the pane (filled in Phase 5), source type icons, and "Select all / none".
```

### P4.4v2 — Chats

```text
TASK: P4.4 from Phase-4-Loop-Prompts.md unchanged, plus: deleting a chat uses a confirmation dialog (red).
```

### P4.5v2 — Pipeline with intent

```text
TASK: P4.5 from Phase-4-Loop-Prompts.md, plus intent first:
- Cheap classifier (rules for obvious greetings + fastModel for the rest; target < 300 ms) → small_talk |
  general | grounded.
- small_talk: no rewrite, no retrieval; fastModel replies naturally in 1–3 sentences in TensorLM's voice and,
  if sources exist, offers one suggested question.
- general: no retrieval; strongModel answers from general knowledge (mode general).
- grounded: rewrite → route (full_context | retrieval) → numbered context (as written), including transcript
  chunks (cite timestamps), dataset chunks (cite sheet/column), web chunks (cite page title + section).
- If grounded retrieval finds nothing relevant (scores under threshold) → mixed: say the sources don't cover it
  and offer a labelled general answer.
DONE WHEN: routing tests cover all intents and the no-match path.
```

### P4.6v2 — Chat route v2

```text
TASK: P4.6 from Phase-4-Loop-Prompts.md, plus:
- Answer settings from the composer: level, length (Short · Standard · Detailed), visuals (Auto · Off),
  thinking (Auto · Off). Pass them into the system prompt and model options.
- Visual intents: when the question asks how something works or its structure, prefer one diagram; when it's
  about numbers, a chart or matrix; when it's about code, a short code example. Never more than 2 visual blocks
  per answer unless asked.
- Thinking (Auto): enable extended thinking only for complex grounded/general questions; stream the provider's
  thinking summary into a collapsible part; record tokens and cost.
- Small talk and general modes also stream, persist, and trace.
```

### P4.7v2 — Citations

```text
TASK: P4.7 from Phase-4-Loop-Prompts.md, plus: transcript citations carry start_seconds (chip label "12:34"),
dataset citations carry sheet/column, web citations carry the page title; fast-run citations resolve after the
deep swap (P3.8v2 rule).
```

### P4.8v2 — Renderer v2 with visual blocks and code

```text
TASK: P4.8 from Phase-4-Loop-Prompts.md, plus visual block components (src/components/answer/visuals/):
- MatrixView: labelled grid, optional heatmap using the skill's sequential scale (cobalt tints), values in
  tabular-nums, hover/focus shows row × column + value, "View as table" toggle.
- TensorShapeView: boxes for named dimensions with sizes, arrows for transformations (reshape, transpose,
  split heads), text alternative.
- StepsView: numbered steps (real sequence) with optional mini-visual, Prev/Next for long sequences.
- CompareView: 2–4 column comparison table, sticky first column on mobile.
- TimelineView: dated events left→right (top→bottom on mobile).
- CodeBlock: language label, filename, copy, wrap toggle, line numbers toggle; "Run" placeholder for Python
  (Phase 6).
All validated with zod; invalid blocks show a quiet "Couldn't draw this" note with the raw spec collapsed.
General mode banner and :::general tag per P4.0v2.
```

### P4.9v2 — Diagrams

```text
TASK: P4.9 from Phase-4-Loop-Prompts.md unchanged (self-drawing diagrams, Canvas Diagram tab, repair once).
```

### P4.10v2 — Chat UI

```text
TASK: P4.10 from Phase-4-Loop-Prompts.md, plus:
- Start state with sources: overview card (2–3 sentences, "Based on 3 sources") + 5 suggested questions as large
  clickable chips (two columns on desktop, stacked on mobile); clicking sends the question.
- Start state without sources: greeting + "Add sources" card + 3 general example prompts.
- "Thinking" collapsible (graphite, chevron, "Thought for 6 s") above answers that used it.
- Message actions: Copy, Regenerate, Simpler, Deeper, Save to note (enabled after Phase 5; hidden behind a
  feature flag until then), 👍, 👎 with inline reasons.
- Action colours per SHARED RULES (e.g. "Clear chat" in red with confirmation).
```

### P4.11v2 — Advanced composer

```text
TASK: P4.11 from Phase-4-Loop-Prompts.md, plus (reference: Hilal's screenshot, in TensorLM's design language):
- Placeholder "Ask a question or create something".
- Right side: "{n} sources" button → popover with source checkboxes (select all/none) — the same selection as the
  sources pane; send button (graphite empty, cobalt with text, Stop while streaming).
- Left side: settings button (sliders icon) → popover: Level (Beginner · Intermediate · Expert), Length
  (Short · Standard · Detailed), Visuals (Auto · Off), Thinking (Auto · Off); saved per notebook.
- Attach → opens Add sources (P3.4v2).
- Voice input (optional): mic button using the browser's speech recognition when available; hidden otherwise.
- Drafts saved per notebook (localStorage) and restored.
- Hint line under the composer (small, graphite): "TensorLM can make mistakes. Check important facts against your
  sources."
```

### P4.12v2 — Citation chips

```text
TASK: P4.12 from Phase-4-Loop-Prompts.md, plus transcript chips ("12:34" opens the transcript viewer at that
time), dataset chips (open the dataset viewer at the sheet/column), web chips (open the reader view at the section).
```

### P4.13v2 — Source viewers

```text
TASK: P4.13 from Phase-4-Loop-Prompts.md (PDF viewer with highlights), plus viewers in the Canvas "Source" tab:
- Document (DOCX/PPTX/MD/TXT/HTML): rendered Markdown snapshot with heading outline; slide numbers for PPTX;
  highlight the cited chunk by scrolling + marker background on its paragraph.
- Web page: reader view of the stored snapshot, title, site, date, "Open original" link.
- YouTube: embedded player (privacy-enhanced mode) + transcript list with timestamps; clicking a citation seeks
  the player and highlights the transcript line.
- Dataset: sheet tabs, virtualised table of the normalised data (first 1,000 rows), column stats panel.
- Image: zoomable image + OCR text toggle.
DONE WHEN: every source type opens in the canvas and every citation lands on the right spot.
```

### P4.14v2 — Selection toolbar

```text
TASK: P4.14 from Phase-4-Loop-Prompts.md (Explain, Simplify, Diagram, Add to note, Copy) for ALL text viewers
(PDF, documents, web, transcript). "Add to note" is enabled after Phase 5 (feature flag); before that, hide it.
```

### P4.15v2 — Quality gate

```text
TASK: P4.15 from Phase-4-Loop-Prompts.md, with the smoke eval extended to 25 cases:
- 8 grounded (PDF), 3 grounded (DOCX/web/transcript), 2 dataset questions, 3 out-of-scope (mixed mode),
- 3 general (no sources), 2 small talk (must be short, natural, no citations),
- 2 diagram requests (valid Mermaid), 2 level checks.
Plus: notebook guide quality check (5 questions, varied, grounded, ≤ 90 chars).
```

---

## Part 10 — Verification checklists (the master loop's audit step)

Each phase's audit follows the same rules as Phase-3-Verification-Checklist.md: evidence for every item,
PASS/FAIL/PARTIAL/BLOCKED, report in docs/reports/, fix plan, no fixing during the audit.

### Phase 3 v2 must-pass items
- [ ] From /app, adding a source creates the notebook and changes the URL without reload
- [ ] Every origin works: files (all listed types), website, YouTube, Drive, copied text, web search import
- [ ] PDF fixtures: owner-locked → Ready; password (correct) → Ready; wrong password → retry; repairable → Ready;
      renamed PNG → image source; scanned → OCR → Ready; 300+ pages → batched; unrepairable → "Couldn't read" + fix
- [ ] Password never in DB, logs or event payloads (grep logs + DB + Inngest payload inspection)
- [ ] 30-page text PDF reaches "Ready to ask" in ≤ 10 s (report), deep pass swaps to Ready without breaking citations
- [ ] Overview + 5 suggested questions appear after fast_ready and refresh on source changes
- [ ] SSRF tests pass (private IPs, redirects, schemes)
- [ ] Datasets: CSV, multi-sheet XLSX, nested JSON produce correct schemas and dataset chunks
- [ ] Confirmation dialogs for remove/delete with red actions; typed confirmation for notebooks with sources
- [ ] 5 and 10 mixed sources at once all finish; test:rls green; CI green

### Phase 4 v2 must-pass items
- [ ] "hi" → short natural reply, no citations, < 2 s
- [ ] General question with 0 sources → answer with the "General answer · not from your sources" line
- [ ] Transformer question → streamed, cited (PDF page highlight works), level respected
- [ ] Diagram request → self-drawing diagram; matrix/tensor-shape/chart blocks render from valid specs
- [ ] Transcript, web and dataset citations open the right spot
- [ ] Composer: {n} sources popover, settings (level, length, visuals, thinking), attach, /, @, drafts
- [ ] Stop/continue, regenerate, simpler/deeper, feedback with reasons
- [ ] Smoke eval (25 cases) thresholds pass; axe zero serious; test:rls green

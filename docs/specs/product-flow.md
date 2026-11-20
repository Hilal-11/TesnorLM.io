# Product flow (v2)

How TensorLM works from a learner's point of view after the v2 plan
(`docs/plans/TensorLM-v2-Part-A-Phases-3-4.md`). Detailed rules live in the specs this page points
to: ingestion (`ingestion.md`, contract `contracts/ingestion.json`) and answers (`answers.md`,
contract `contracts/answer-format.json`). The design skill (`.claude/skills/tensorlm-design/SKILL.md`)
decides how things look and read.

## 1. The idea in one paragraph

You open TensorLM and you are already in a workspace: a composer at the bottom and an invitation to
add sources. Ask anything straight away (general chat, even "hi"), or add a paper, a deck, a
spreadsheet, a web page, a video or some copied text. Within seconds the text is ready to ask;
tables, figures and layout improve in the background. TensorLM tells you in two or three sentences
what your sources cover and suggests five questions. It never explains the whole document unless
you ask. Answers come at your level, with citations that open the exact passage, and with a diagram,
chart, matrix or code example when that helps. Anything worth keeping goes into a note.

## 2. Places

| Place | URL | What it is |
| --- | --- | --- |
| Home = main shell | `/app` | The workspace with no notebook yet. Composer works at once (general chat, "0 sources"). |
| A notebook | `/app/n/[id]` | The same workspace component, with that notebook's sources, chats and guide. |
| Library | `/app/notebooks` | Every notebook as grid, list or board. |
| Notes | `/notes`, `/notes/[id]` | All notes; full-page editor (Phase 5). No note pop-ups. |

**Lazy notebook.** `/app` has no notebook row. The first action that needs one (adding a source or
sending a message) creates "Untitled notebook" and replaces the URL with `/app/n/[id]` by shallow
routing: no reload, no flash, focus stays where it was. A visit where nothing was added or asked
leaves nothing behind. The notebook gets a suggested title from its sources later (section 5); a
rename by the person always wins.

## 3. The workspace

```
┌ Sidebar ─────┐┌ Sources (272 px) ─┐┌ Conversation ───────────────────┐┌ Canvas (on demand) ┐
│ New notebook ││ + Add sources     ││ overview + 5 suggested questions ││ Source · Diagram   │
│ Library      ││ source cards with ││ (or greeting + Add sources card) ││ viewers: PDF, doc, │
│ Notes        ││ live status       ││ … messages …                     ││ web, YouTube,      │
│ Recent …     ││                   ││ [ composer, always at the bottom]││ dataset, image     │
└──────────────┘└───────────────────┘└──────────────────────────────────┘└────────────────────┘
```

- Empty shell: greeting "What do you want to understand today?", a large dashed **Add sources**
  card (drop target; Files · Web · YouTube · Drive · Text) and three example prompts for general
  chat.
- Under 1024 px one pane at a time (Sources · Chat · Source tabs); the composer stays at the bottom.
- Header: the notebook title (click to rename), source count, notebook menu (Rename, Change colour,
  Delete notebook in red, with confirmation).

## 4. Adding sources

One **Add sources** dialog, opened from every "Add sources" button, the sources pane, the composer's
Attach, `Ctrl/⌘ U` and the empty-state card. Dragging files anywhere over the shell, or pasting
files, images, links or text, uses the same flows.

| Origin | How | Becomes |
| --- | --- | --- |
| Upload files | drop zone or browse; many files and folders | PDF, Word, PowerPoint, Excel, CSV, JSON, image, text, Markdown, HTML |
| Website / YouTube | paste links, one per line, checked as you type | web page snapshot, or a YouTube transcript with timestamps |
| Google Drive | Google Picker, `drive.file` scope (only files you pick) | the exported Doc / Sheet / Slides / PDF / image |
| Copied text | optional title + text | a text source (title suggested when empty) |
| Search the web | "Fast research": query → 8–10 results → tick → import | web page sources |

The dialog closes as soon as sources are added; their progress shows in the sources pane. People
never wait inside a dialog. Problems show per item, with the reason and the fix.

**Nothing is rejected at upload.** Every file is uploaded and the worker decides how to read it.
Only the storage plan's size limit stops a file in the browser ("This file is 120 MB. Your plan
allows 50 MB per file. Split it, or upgrade for larger files.").

## 5. Reading sources: two passes, honest status

```
Uploading → Reading → Ready to ask → (Improving tables and figures) → Ready
                 ↘ Repairing file ↗     ↘ Needs password (type it, Unlock)
                 ↘ Running OCR (scans) ↗
```

1. **Fast pass** (seconds): plain text per page with pypdfium2 (never PyMuPDF: AGPL), paragraph
   chunks with page numbers, embeddings. The source becomes **Ready to ask**.
2. **Deep pass** (background): Docling layout, tables, figures and captions, OCR where needed. It
   swaps in atomically; answers keep working throughout, and citations made during the fast pass
   still open the right place afterwards.

Every PDF is accepted, and the worker tries everything before giving up: permission-locked files
open by themselves, password-locked files ask for the password, damaged files are repaired (or
rendered and read as scans), scans get OCR, huge files are read in batches (up to `MAX_PAGES`,
said clearly). Only when every path fails does a source end in **Couldn't read**, and even then it
stays in the notebook with the reason and a next step. Notices tell people about partial results
("TensorLM read the first 2000 of 2400 pages.").

## 6. The notebook guide

When a source is ready to ask (and whenever sources change), TensorLM writes, from titles, headings,
first passages and figure captions only:

- a suggested notebook title (until the person renames it),
- a 2–3 sentence **overview** of what the sources cover (nothing beyond them),
- exactly **5 suggested questions** (core idea, how it works, a key figure or table, a comparison or
  limitation, a practical use), each ≤ 90 characters and shown as clickable chips,
- a 1–2 sentence summary of each new source.

It never writes a full explanation or a lesson on its own. Deep explanations happen only when asked.

## 7. Asking

- The composer is always at the bottom: "Ask a question or create something", a **{n} sources**
  picker, settings (level, length, visuals, thinking), Attach, `/` commands, `@` sources, voice
  where the browser supports it, drafts kept per notebook.
- **Small talk** ("hi", "thanks") gets a short, natural reply: no citations, no retrieval.
- **General** questions (no sources, or unrelated to them) are answered from general knowledge under
  one quiet line: "General answer · not from your sources".
- **Grounded** questions get streamed answers with citations [1] that open the exact passage with a
  marker highlight. When the sources don't cover something, TensorLM says so and offers a labelled
  general answer (mixed mode).
- Visuals when they help, at most two per answer unless asked: self-drawing diagrams, charts, matrix
  and heatmap views, tensor-shape views, step-by-step visuals, comparison tables, timelines, code.
  Runnable Python and interactive visuals come in Phase 6.
- Three follow-up questions after each answer.

## 8. Notes (Phase 5)

A full `/notes` workspace: rich editor (headings, checklists, code, math, diagrams, tables,
citations), autosave, search, tags, pin, move, duplicate, export, version history, trash and AI
actions. Answers and PDF passages are saved with their citations, which stay clickable.

## 9. Trust: confirmations and action colours

These rules override the design skill's earlier "prefer Undo" rule (amendment in S0).

- **Destructive actions always confirm in a dialog.** The title names the action and the thing
  (Delete "Transformers notes"?), the body states the consequence ("This deletes 3 sources and 12
  notes. You can't undo this."), and the buttons are **Cancel** (secondary, focused by default) and
  the action in danger red ("Delete notebook"). Deleting a notebook that has sources also asks
  people to type its name. Non-destructive actions (reprocess) don't confirm.
- **Action colours.** Danger red: delete, remove, sign out, disconnect, discard, clear. Success
  green: saved, added, ready, done. Warning amber: caution, low confidence, partial. Cobalt: primary
  actions and "you are here". Status is always icon + word + colour, never colour alone.
- Menus put destructive items last, in red, separated from the rest.

## 10. Privacy rules that shape the flow

- PDF passwords are never stored in the database, logs or queue events: they live in Redis for at
  most 10 minutes, are read once by the worker and deleted.
- Google tokens are used once to download the picked files and never stored.
- Web pages are fetched server-side with SSRF protection; a snapshot is stored so answers stay
  stable.
- Logs never contain document text, prompts, answers, passwords or keys.

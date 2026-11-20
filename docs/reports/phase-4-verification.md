# Phase 4 verification — Chat with sources

Audited 2026-11-20 on branch `phase-4`. Evidence comes from the **local Supabase stack**
(migrations 0001–0005), unit and component tests (Vitest + Testing Library + axe), database
tests with mock models against the local stack, and a production build. The real models could
not be exercised: the Anthropic account returned **"Your credit balance is too low"** (see
"Needs you").

## Summary

| Area | Status | Evidence |
| --- | --- | --- |
| P4.0 Answer spec + contract | PASS | `contracts/answer-format.json`, `docs/specs/answers.md`, examples; contract sync + zod validation tests |
| P4.1 Database (chats, messages, feedback, notes, source selection) | PASS locally | `0005_chat.sql`; RLS suite covers `feedback`, `notes`; people can't write messages |
| P4.2 Workspace layout | PASS (build, types) · manual check pending | three resizable panes ≥1024px, tabs below; canvas Source/Diagram |
| P4.3 Sources pane | PASS | include checkbox (optimistic + rollback), "Asking k of n sources", disabled reasons |
| P4.4 Chats + messages persistence | PASS | `tests/rls/chats.test.ts` 7 passed (CRUD, 404s for others, versions, crash recovery, titles) |
| P4.5 Retrieval + routing | PASS | 26 citation/context tests; full-context vs retrieval routing; escaped `<sources>` |
| P4.6 Chat route v2 | PASS (mock models) | `tests/rls/respond.test.ts` 8 passed: stream order, usage/cost, cache breakpoints, stop/continue/regenerate, 429, 404, upstream error |
| P4.7 Validated citations | PASS | unknown numbers dropped and counted, renumbering, years and code left alone |
| P4.8 Renderer v2 | PASS | 12 renderer tests incl. sanitize (no script/handlers/`javascript:`), broken LaTeX fallback, axe on spec examples |
| P4.9 Diagrams + auto-repair | PASS (mock model) | `describe` tests 3 passed; `tests/rls/diagram-repair.test.ts` 4 passed (ownership, reply check, saved fix) |
| P4.10 Chat UI | PASS (component) | 9 chat tests: actions, follow-ups, citations open, Continue/Try again, versions, ungrounded note |
| P4.11 Composer | PASS (component) | Enter/Shift+Enter, `/` commands, `@` sources, Stop, disabled reason, axe |
| P4.12 Citation chips | PASS (component) | chip labels "Source n: title, page p", hover/focus preview, opens the PDF |
| P4.13 PDF viewer + highlights | BUILT · manual check pending | pdf.js from `/vendor/pdfjs`, lazy pages, text layer, bbox highlights |
| P4.14 Selection toolbar + notes | BUILT · manual check pending | Ask about this · Explain · Save note · Copy |
| P4.15 Quality gate | PARTIAL | see below |

Totals: **27 unit/component files, 310 tests passed**; **8 database files, 121 tests passed**
(local stack); `eslint .` clean; `tsc --noEmit` clean; `next build` passes.

## Quality gate (P4.15)

- **Smoke evals** (`npm run eval:smoke`, real models, 4 cases: grounded citations with the right
  pages, prompt injection inside a source, off-topic → "Not from your sources", `/diagram` gives an
  allowed Mermaid type): **BLOCKED**. Every call returned `AI_APICallError: credit balance is too
  low`. The failure path itself behaved correctly: the answer was saved as an error with the
  learner message "The answer stopped because the AI service didn't respond. Try again."
- **Security**
  - Bug found and fixed: on a model error, the AI SDK's default `streamText` error handler printed
    the full request to the server log, **including source text and the question**. It now has a
    silent `onError`; errors are still handled from the stream and logged as metadata only
    (chat id, message id, error type). Checked by grepping the eval output: no source text left.
  - Answers are sanitized (allow-list); raw HTML, scripts, event handlers and `javascript:` links
    are stripped (test). Mermaid runs with `securityLevel: "strict"`.
  - The system rules tell the model that text inside `<sources>`/`<focus>` is data; source
    attributes are escaped and source text can't close or forge tags (tests).
  - Messages are written only by the server after the ownership check; people can read their own
    messages and nothing else (RLS tests). Diagram repair only accepts the person's own assistant
    message, and the code must already be in it.
  - Traces carry metadata only; prompts and answers are never logged.
- **Accessibility**: axe passes on the spec's example answers and the composer; chips, toolbar,
  version switcher and feedback have accessible names; streaming status is announced
  (`role="status"`); errors use `role="alert"`; the PDF toolbar is keyboard reachable.
- **Performance**: not measured with real models (blocked). Built in: prompt caching on the rules
  and on full-context sources, PDF pages render only near the viewport, Mermaid and KaTeX load
  lazily, the renderer is memoised per message.

## Not done / known gaps

- Manual browser pass of the workspace, PDF highlights and selection toolbar with a real paper.
  The pieces are covered by unit tests and the build, but not yet clicked through end to end.
- Rename chat uses the browser's prompt dialog; a proper inline rename is a follow-up.
- The Figures tab in the Sources pane isn't built; figures show in Source details.
- Migration `0005_chat.sql` is applied **locally only**. The cloud project still has 0001–0004, so
  the notebook page will fail there until 0005 is applied (it reads `documents.included` and the
  new chat columns).

## Needs you

1. **Anthropic credits**: add credits (and a monthly spend cap) at console.anthropic.com →
   Plans & Billing. Then run `cd apps/web && npm run eval:smoke` (local stack; ~4 short answers).
2. **Approve migration 0005 on the cloud project**, then regenerate types (`npm run db:types`).
   I'll run it only after you say yes.
3. **Optional keys** (names only, in `.env.example`): `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`,
   `LANGFUSE_HOST` for traces; `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` for rate limits
   (without them the database fallback is used).
4. **Manual check**: upload "Attention Is All You Need", ask "Why are dot products scaled?",
   click a citation (the PDF should open at page 4 with the passage highlighted), select a
   sentence and use "Ask about this", try `/diagram`.

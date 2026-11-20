# Answers spec (Phase 4)

How a question becomes a grounded, cited, level-aware answer. Grounding and citation quality matter
more than any feature here.

- **Contract:** [`contracts/answer-format.json`](../../contracts/answer-format.json): levels, directives,
  fenced blocks, citation limits, message states, modes, feedback reasons, slash commands and limits.
  TypeScript: `apps/web/src/lib/answers/format.ts` (generated copy `format.generated.ts`, synced by
  `npm run contract:sync`).
- **Chunks:** `docs/specs/ingestion.md` §10: `page_start`, `page_end`, `bboxes` (PDF points, top-left
  origin, pages from 1), `kind`, `figure_id`.
- **UI rules:** `.claude/skills/tensorlm-design/SKILL.md` (7.4, 8.3, 9, 10.2–10.3) overrides this file
  on looks and copy.

## 1. Flow

```text
composer ──POST /api/chat {chatId, message, level, command?, attachments?, regenerateOf?, continueOf?}
  1. requireUser → chat ownership (404) → rate limit (429 rate_limited, retry time)
  2. save the user message (or reuse it for regenerate/continue)
  3. rewrite   fastModel → {standalone, queries[1..3], intent, mentions_figure}   (skipped for a
               first message without references)
  4. route     selected Ready sources → no_sources | full_context | retrieval
  5. context   numbered <sources> block + sourceMap n → chunk
  6. stream    data-status {stage: rewriting} → data-status {stage: reading, sources[]} →
               data-sources (provisional map) → text tokens
  7. finish    citations validated + renumbered (§5) → message saved (parts, text, citations,
               usage, cost, latency, mode) → follow-ups (fastModel) → title (first answer) →
               data-citations / data-followups sent before the stream closes
```

Persistence never waits on the model: the assistant row is created as `streaming`, checkpointed
about every 2 s, and finished as `complete`, `stopped` (abort: text kept) or `error`.

## 2. Routing

| Mode | When | Context |
| --- | --- | --- |
| `no_sources` | no selected Ready source | none; the whole answer is general knowledge, every passage in `:::general`, and it invites adding a source |
| `full_context` | selected sources' current-run chunk tokens ≤ `FULL_CONTEXT_TOKEN_LIMIT` (default 60 000) | **all** chunks of the selected documents in reading order (document order, then `chunk_index`), each numbered. Stable order → cacheable prefix |
| `retrieval` | larger | `hybrid_search` per rewritten query (k 20) → reciprocal rank fusion → dedupe → top 10 → neighbour chunks when adjacent (≤ ~12 000 tokens) → figure caption chunks when `mentions_figure` or `intent = diagram`. Reranker hook for Phase 5 |

Both grounded modes number every passage, so every `[n]` maps to a chunk with pages and boxes.

## 3. Context format and prompt safety

```xml
<sources>
<source n="1" document="Attention Is All You Need" pages="3–4" section="3.2 Attention" kind="text">…</source>
</sources>
```

Text inside `<sources>` is untrusted data from people's files. The system prompt says so and tells
the model to ignore any instructions in it. Attachments (quoted passages) are wrapped the same way
in `<focus>`. History: the last 6 turns as plain text (citation markup stripped).

## 4. Answer format

- Markdown with GFM; math `$…$` and `$$…$$` (KaTeX).
- Directives: `:::key-idea` (max 1, a 3 px left rule, "Key idea"), `:::note`, `:::important`,
  `:::general` (graphite tag **"Not from your sources"**). Anything not drawn from the sources must be
  inside `:::general`.
- ```` ```mermaid ```` flowchart/graph/sequence only, ≤ 12 nodes; rendered as a self-drawing diagram
  card with a text alternative.
- ```` ```chart ```` JSON: `{type: line|bar|scatter, title?, xKey, xLabel?, yLabel?, series[≤5], data[≤1000]}`
  validated with zod; invalid → "Couldn't draw this chart" with the JSON collapsed.
- No raw HTML (rehype-sanitize). Worked examples: a "Worked example" heading + numbered steps.

## 5. Citations

- Syntax `[n]`, `[n, m]`, `[n–m]`; at most 3 per sentence; one per source-based claim.
- The server parses them outside code and math, drops numbers not in the sourceMap (logged as
  `citation_invalid`), collapses duplicates and **renumbers by first appearance** (1, 2, 3…).
  `[2023]`-style numbers above the source count are left as text.
- Saved per message: `n, chunk_id, document_id, document_title, page_start, page_end, bboxes, kind,
  figure_id, quote_preview (≤ 300 chars)`.
- A grounded-mode answer with no citations and no `:::general` is flagged `ungrounded`; the UI shows
  "This answer has no citations. Check it against your sources."

## 6. Levels

Beginner · Intermediate · Expert (`beginner | intermediate | expert`), styles in the contract.
"Make simpler" / "Go deeper" re-ask one level down/up and replace the answer in place (a new
version), and remember the level for the chat.

## 7. No source match

When the sources don't cover the question: say so plainly ("Your sources don't mention positional
encoding. I can explain it from general knowledge, marked as such."), then, if helpful, explain in
`:::general`. Never invent citations.

## 8. Stop, continue, regenerate

| Action | Effect |
| --- | --- |
| Stop (button or Esc) | aborts the stream; the text so far is saved with status `stopped`; UI: "Stopped" + **Continue** |
| Continue | new request with `continueOf`: the partial answer is given back with "Continue exactly where you stopped"; the result is appended to the same message |
| Regenerate | new assistant message, same `parent_id`, `version + 1`; UI "Version 2 of 2" with arrows |

## 9. Message states and feedback

States: `streaming`, `complete`, `stopped`, `error` (learner copy: "The answer stopped because the AI
service didn't respond. Try again."). Feedback: 👍 / 👎 with reasons Wrong · Unclear · Missing source
and an optional comment (≤ 1000); one row per person per message (a new vote updates it).

## 10. Limits, cost, privacy

- Message ≤ 4000 chars, quote ≤ 1500. Rate limit: `CHAT_LIMIT_PER_MINUTE` (10) and
  `CHAT_LIMIT_PER_DAY_FREE` (50) per person (Upstash when configured, else the database).
- Usage per message: input, output, cache read, cache write tokens, `cost_usd` (prices in
  `src/lib/models.ts`), model, `prompt_version`, latency, mode.
- Anthropic prompt caching: breakpoints after the system prompt, and after `<sources>` in
  full-context mode.
- Logs and traces carry ids, counts, tokens, latency, cost, mode and error codes. Never document
  text, prompts or answers.

## 11. Acceptance (milestone)

In a notebook with a Ready paper, "How does multi-head attention work?" streams an answer at the
chosen level with validated citations that open the exact page with a marker highlight; diagrams
draw themselves and repair once; general knowledge is labelled "Not from your sources"; stop,
continue, regenerate, simpler, deeper, feedback and notes work; a repeated question shows cache
reads.

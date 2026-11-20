# Chat engine spec

How a message becomes a streamed, cited, beautifully rendered answer. Plan:
`docs/plans/TensorLM-Chat-Engine-Phase.md` (tasks C0–C12). API facts and their sources:
`docs/research/claude-api-notes.md` (cited below as **notes §n**). Browser event protocol:
`contracts/chat-events.json` → `apps/web/src/lib/chat/events.ts`. UI law: the design skill.

This replaces, for chat: the AI SDK chat route (`src/lib/answers/respond.ts`), the `[n]` citation parser
(`src/lib/answers/citations.ts`), the rewrite/route pipeline as an intent classifier, and the level selector.
Retrieval (`hybrid_search`) and ingestion stay.

## 1. Decisions that differ from the plan (and why)

The plan was written before the docs were read. The docs settle these points differently:

| # | Plan said | Decision | Why |
|---|---|---|---|
| D1 | Source pack at the start of the **first user message**, rebuilt identically each turn | Sources always reach Claude inside **`tool_result` blocks**. Pack mode appends a synthetic tool call (`assistant: tool_use read_sources` + `user: tool_result` with `search_result` blocks) right after the user message that needs it; tool mode returns them from real `search_sources` calls. | Opus/Sonnet/Haiku 5.5 run the preserved-thinking prefix check: rebuilding or changing the first message invalidates every later thinking block (notes §4). The docs also say file text people didn't write as instructions belongs in `tool_result` blocks (prompt-injection guard). Appending keeps the cache prefix too. |
| D2 | Pack ↔ tool mode chosen per request; web search toggled per message | **`tools` is fixed per chat** at its first request: `search_sources` (always), plus `web_search` (see D3). Mode only decides whether our code *appends* a pack. | Adding or removing a tool is a prefix change (notes §4) and resets the cache (notes §8). |
| D3 | Web search as a per-message toggle | `web_search` is declared in every chat whose model supports it, with `defer_loading: true`; turning the toggle on/off appends a system message with a `tool_addition` / `tool_removal` block (beta `mid-conversation-tool-changes-2026-07-01`). | Keeps `tools` unchanged. **Verify in C4** that server tools accept `defer_loading` (notes §4 [unconfirmed]); fallback: declare it normally and enforce "off" with an appended system message plus the per-user daily cap, logging any search made while off. |
| D4 | Older turns replaced by our own `chats.summary` | **No trimming in v1** (1M-token context). A chat over 600K input tokens turns on server-side **compaction** (beta `compact-2026-01-12`); compaction blocks are stored in `raw_content` like any other block. `chats.summary` is not needed. | Our own summary invalidates the kept turns' thinking; API compaction doesn't (notes §4). |
| D5 | Effort default `medium` | Kept, and **always sent explicitly**. | Sonnet 5.5's default is `high` (notes §2). |
| D6 | `CHAT_MAX_TOKENS=16000` | Recommend **32000** (env-configurable). | Thinking counts toward `max_tokens` (notes §3); streaming has no timeout risk. 16000 stays valid but gives more length-limit stops at higher effort. |
| D7 | Interrupted answers append to "the same message" | The **displayed** message is one; the **API history** gets the documented continuation user message ("Your previous response was interrupted and ended with … Continue from where you left off.") and the continuation reply, both stored. | No prefill on 4.6+ (notes §6). |
| D8 | Citation lookup by `search_result_index` | Look up by the citation's **`source`** (`tensorlm://chunk/<id>`, returned on every citation), cross-checked with `search_result_index` over the whole request. | `source` is unambiguous; the index counts every `search_result` block in the request, history included (notes §5). |
| D9 | Spend limit = 429 without `retry-after` | Also a **400** when an org/workspace spend limit is set. Both map to `spend_limited` (no retry). | notes §9. |
| D10 | System prompt in `src/prompts/chat-system.ts` with `PROMPT_VERSION` | Each chat stores the **`system_version` and `tools_version`** it started with and keeps sending those exact texts; new chats get the newest. Old versions stay in code until no running chat uses them. | A release that changes `system`/`tools` would invalidate every running chat's thinking (notes §4). Safety fixes are appended as system messages. |
| D11 | (not in plan) | Refusal fallbacks: server-side `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) on Sonnet/Opus 5.5, **after reading the refusals-and-fallback page in C4**; Haiku 5.5 has none. | Claude API guidance for these models; a refusal otherwise just stops. The owner can turn it off (`CHAT_REFUSAL_FALLBACK=0`). |

## 2. Request building

One request = `client.beta.messages.stream(params, {signal})` (beta namespace because of D3/D4/D11 and
`thinking-binding-controls-2026-08-01`, which adds `input_transformations` for monitoring).

| Field | Value |
|---|---|
| `model` | chat's model, validated against the registry (C1); default `CHAT_MODEL_DEFAULT` |
| `max_tokens` | `CHAT_MAX_TOKENS` (D6) |
| `thinking` | `{type: "adaptive", display: "summarized"}` |
| `output_config` | `{effort: chat.effort}` (always explicit, D5). Never `format` here (citations, notes §5). |
| `system` | the chat's `system_version` text, one block, **identical bytes every request** |
| `tools` | the chat's `tools_version` list (D2/D3), identical every request; `search_sources` has `strict: true`, `eager_input_streaming: true` |
| `messages` | stored history (section 4) + this turn's new blocks |
| `cache_control` | top-level `{type: "ephemeral"}` (automatic, moves with the conversation) |
| `betas` | `thinking-binding-controls-2026-08-01` always; others only when the feature is used |
| `tool_choice` | omitted (`auto`); never `any`/`tool` (400 on 5.5) |

Explicit breakpoints: the last `search_result` of each **pack** `tool_result` gets `cache_control: {type:
"ephemeral", ttl: "1h"}` (at most 2 kept: the newest pack and the one before; older ones drop their marker,
which isn't a content change). 1h breakpoints always precede the automatic 5m one (notes §8).

Never in the prefix: timestamps, request ids, user names, today's date. When the date matters, a text block
in the new user message says it (and stays).

## 3. Sources

### 3.1 Passages as search results

Each chunk → one `search_result`:

- `source`: `tensorlm://chunk/<chunk_id>`; figure-caption chunks `tensorlm://figure/<figure_id>`.
- `title`: `<document title> · p. 4` (`· pp. 4–5`, `· slide 3`, `· 12:34`, `· Sheet1`), ≤ 200 chars.
- `content`: the chunk split into **1–3 text blocks** at paragraph, then sentence boundaries (each ≥ 120
  characters where possible; never split inside a formula, code span or table).
- `citations: {enabled: true}` on **every** result in every request (all-or-nothing, notes §5).

A per-request **source map** enumerates every `search_result` in request order (history and new blocks):
`index → {source, chunkId|figureId, blocks: [{text, charStart, charEnd}]}`. It's rebuilt from stored
`raw_content` each request, so it's always consistent with what was sent.

### 3.2 Mode

Decided per **turn** from the chat's selected Ready sources:

- `none`: no Ready selected sources. Claude can still call `search_sources`; it returns "No sources are
  selected." (text `tool_result`).
- `pack`: estimated tokens of all selected sources' chunks ≤ `SOURCE_PACK_TOKEN_LIMIT` (60K default).
- `tool`: otherwise.

### 3.3 Pack mode

On the first turn that has selected sources (and whenever a new source becomes selected), our code appends
after the user's message:

```
assistant: [{type: "tool_use", id: "toolu_tlm_pack_<n>", name: "search_sources",
             input: {query: "(all passages of the selected sources)", document_ids: [...]}}]
user:      [{type: "tool_result", tool_use_id: "toolu_tlm_pack_<n>",
             content: [search_result × N  (reading order; last one carries the 1h breakpoint)]}]
```

- Later turns don't repeat a pack: it's already in the history (and the cache).
- A newly selected source → a new pack pair with only that source's passages.
- A deselected source → a text block in the next user message: "Note: the user turned off these sources:
  <titles>. Don't use them." The server also drops citations to deselected sources.
- Total pack tokens beyond `SOURCE_PACK_TOKEN_LIMIT` → stop appending packs; later turns are tool mode.

### 3.4 Tool mode

`search_sources {query: string (≤ 300 chars), document_ids?: string[]}`. Description: "Search the user's
uploaded sources. Use it for any question about their documents, notes or data. Don't use it for greetings or
general knowledge." Server execution: validate input (zod; ids must be selected sources of this chat's
notebook) → embed query → `hybrid_search(match_count 10, p_document_ids)` + neighbours as today → figure
captions when the query mentions figures/tables → `tool_result` of `search_result` blocks, or one text block
"No matching passages found." Max 3 `search_sources` calls per answer round, 4 rounds per answer.

### 3.5 Figures

Claude may write `![Figure 3](tensorlm-figure:<figure_id>)`. The server resolves ids that appear in this
chat's source map and belong to the user, signs a 10-minute URL and emits a `figure` event; unknown ids are
dropped silently (logged by id only).

## 4. History and persistence

### 4.1 What's stored

`messages.raw_content` holds **exactly** what was sent or received, per API message:

- user messages: our text block(s) + image blocks (+ code-written notes), as sent;
- assistant messages: the `content` array from `finalMessage()` (thinking with signature even when empty,
  text with citations, `tool_use`, `server_tool_use`, `web_search_tool_result` with encrypted fields,
  `fallback`, compaction blocks), never re-serialized through our own types;
- synthetic messages our code adds (pack pairs, tool results, continuation prompts, system messages) are
  stored as their own rows with `kind` (`pack`, `tool_result`, `continue`, `system_note`) and hidden from the
  UI.

`messages.render` holds what the UI shows: text blocks with mapped citations, figures, thinking summary,
tool activity, notices. Render is derived from raw; raw is never derived from render.

The request's `messages` = all non-deleted rows of the chat's **active branch**, in order, `raw_content`
unchanged.

### 4.2 Branches: regenerate, versions, edit

- **Regenerate** the latest answer: drops that answer's rows (assistant + its tool rows) from the active
  branch and streams a new version (`parent_id` = the user message, `version + 1`). Older versions stay
  stored for the "2 of 2" switcher. Switching versions is allowed only on the latest answer.
- **Edit last message**: only the latest user message; creates a new user row (version + 1) and a new answer.
- **Simpler / Deeper**: a regenerate with an extra text block in the user turn's request: "Answer again,
  simpler." / "…, in more depth." stored with that version.
- Editing earlier messages isn't offered (prefix check + cache).

### 4.3 Stop, interruption, continue

- **Stop** (client abort): abort the SDK stream; keep complete blocks, drop incomplete thinking/tool blocks,
  keep the partial text; status `stopped`.
- **Interrupted** (mid-stream `error` event or network drop after text began): same handling, status
  `interrupted`.
- **Continue** (`continueOf`): append a `continue` user row: "Your previous response was interrupted and
  ended with:\n\n<partial text>\n\nContinue from where you left off." and stream; the UI appends the new
  text to the displayed message (render merges both).
- **Length limit** (`max_tokens`): status `complete`, `stop_reason max_tokens`, notice + Continue (same
  continuation pattern).

### 4.4 Checkpoints

While streaming, the assistant row's `render` and plain `content` are checkpointed every ~2 s. Rows left
`streaming` by a crash become `interrupted` on the next load (raw = complete blocks only).

### 4.5 Prefix-check safety net

If a request fails with "bound to a different conversation": log (ids only), retry once with
`thinking.block_binding.prefix_mismatch_behavior: "drop_block"`, set `chats.drop_thinking = true` so later
requests keep sending it, and alert. Every response's `input_transformations` count is logged (should be 0).

## 5. Tool loop

```
round = 0
loop:
  stream request → map events (section 6)
  final = finalMessage(); persist assistant row (raw)
  switch final.stop_reason:
    end_turn | stop_sequence → done
    tool_use     → run each search_sources call (validated) → one user row with all tool_results →
                   round++ ; if round == 4 → done with notice "max_rounds" ; else loop
    pause_turn   → (server tool still working) loop with the history unchanged ; counts as a round
    max_tokens   → done (length limit; Continue offered)
    refusal      → done with neutral notice (after any server-side fallback, D11)
    other/unknown→ done with neutral notice, logged
```

If `max_tokens` or `refusal` arrives on a turn containing a `tool_use`, the tool isn't run.

## 6. Streaming pipeline and the browser protocol

Server → browser: `text/event-stream`, one JSON event per `data:` line, `event:` = event type. Contract:
`contracts/chat-events.json` (protocol version 1); the browser ignores unknown event types.

| Claude event | Our event(s) |
|---|---|
| (request accepted) | `start` {protocol, chatId, notebookId, userMessageId, messageId, model, effort} → `status thinking` |
| `content_block_start` thinking / `thinking_delta` | `thinking_delta {text}` |
| thinking `content_block_stop` | `thinking_done {seconds}` |
| `content_block_start` text (first of the answer) | `status writing` |
| `text_delta` | `text_delta {blockIndex, text}` (blockIndex = our rendered text-block counter) |
| `citations_delta` | `citation {blockIndex, citation}` (mapped, section 7) |
| `tool_use` search_sources (block stop) | `status searching_sources` + `tool_activity {id, kind: sources, query}`; after execution `tool_activity {id, …, resultCount}` |
| `server_tool_use` web_search | `status searching_web` + `tool_activity {id, kind: web, query}` |
| `web_search_tool_result` | `tool_activity {id, …, resultCount}` (0 on an error object) |
| `signature_delta`, `ping`, `input_json_delta` | nothing |
| unknown | nothing (type logged once per process) |
| final `message_delta` usage (summed over rounds) | `usage {...}` |
| end | `done {messageId, stopReason}` |
| mid-stream `error` | `error {code: interrupted, retryable: true}` + `done {stopReason: interrupted}` |
| after done (async) | `followups {questions}`, `title {title}` |
| trust checks | `notice {code}` (`no_citations`, `max_rounds`, `refusal`, `length_limit`, `model_changed`) |

The SSE response starts before the Claude call (first `status` < 300 ms). Text deltas are flushed as they
arrive; the browser batches renders per animation frame.

## 7. Citations

`search_result_location` → source map (D8) → `{kind: "source", number, chunkId|figureId, documentId,
documentTitle, sourceType, page {start, end} | slide | seconds {start, end} | sheet, bboxes (only for the
cited text blocks' range when available), citedText}`.

- Numbers per answer in order of first appearance; the same chunk reuses its number; the chip renders at
  the end of its text block.
- Ownership: a `source` that isn't a chunk/figure of this chat's notebook (or of a deselected source) is
  dropped and logged.
- `web_search_result_location` → `{kind: "web", number, url, title, citedText}`; `encrypted_index` stays
  in `raw_content` only.
- Trust: an answer with source mode `pack`/`tool` that called sources (or had a pack) and ends with zero
  source citations gets `notice no_citations`: "This answer has no citations. Check it against your
  sources."

## 8. Helper calls (HELPER_MODEL, structured outputs)

Separate `client.messages.parse` calls with `zodOutputFormat` (no sources, so no citations conflict):

| Helper | Input (bounded) | Output schema | When |
|---|---|---|---|
| Suggested questions | titles, headings, per-source summaries, figure captions (≤ 6K tokens) | `{questions: [{text, kind}]}`; zod checks 4–5 items, text ≤ 90 chars, kinds varied | source reaches fast_ready/ready or selection changes; debounce 20 s; skip if sources hash unchanged |
| Follow-ups | the answer's plain text (≤ 2K tokens) + question | `{questions: string[]}`; 3 items ≤ 60 chars | after `done`, in parallel |
| Chat title | first question + answer opening | `{title}` 3–6 words, sentence case | after the first answer; never overwrites a rename |
| Mermaid repair | broken code + parser error | `{code}` | once per diagram, on render failure |

All helpers: 10 s timeout, one retry, silent failure, cost logged; effort `low`.

## 9. Errors

| Where | Condition | Our code | Retry | UI copy (message · fix) |
|---|---|---|---|---|
| before stream | SDK retries exhausted on 429 with `retry-after` | `rate_limited` | yes, after the delay | "TensorLM is busy right now." · "Try again in a moment." |
| before stream | 429 without `retry-after`, or 400 spend-limit message | `spend_limited` | **no**; alert the owner | "TensorLM is temporarily unavailable." · "Please try again later." |
| before stream | 529 / `overloaded_error` after SDK retries | `overloaded` | one more after 2 s, then error | "Claude is busy right now." · "Try again in a moment." |
| before stream | `APIConnectionTimeoutError` / 504 | `timeout` | one more, then error | "The answer took too long to start." · "Try again." |
| before stream | 401 / 403 | `unavailable` | no; alert | "TensorLM can't reach Claude right now." · "Please try again later." |
| before stream | 402 | `unavailable` | no; alert | same |
| before stream | 413 or context too long | `too_large` | no | "This chat is too long to continue." · "Start a new chat to keep going." |
| before stream | other 400 (incl. web search disabled by the org) | `bad_request` | no; logged with request id | "We couldn't send that message." · "Try rephrasing it, or start a new chat." |
| before stream | prefix check 400 | (recovered, 4.5) | once with `drop_block` | — |
| mid-stream | `error` event / dropped connection | `interrupted` | user: Continue | "The answer was interrupted." · "Continue to finish it." |
| our limits | per-user rate limit (Upstash/DB) | `user_rate_limited` | after reset | "You've asked a lot of questions in a short time." · "Try again in {minutes} min." |
| our limits | web search daily cap | `web_search_limit` | tomorrow | "You've used today's web searches." · "Ask without web search, or try again tomorrow." |
| anything else | unexpected | `internal` | user: Try again | "We couldn't finish this answer." · "Try again." |

Copy lives in `contracts/chat-events.json` (`errors`). Never "Something went wrong".

## 10. Cost, usage and limits

- Per round: `input_tokens`, `cache_read_input_tokens`, `cache_creation.ephemeral_5m/1h_input_tokens`,
  `output_tokens` (includes thinking), `server_tool_use.web_search_requests`. Summed per answer; cost from
  `pricing.ts` (notes §12; Haiku's >100K tier per request). Stored in `messages.usage`.
- Logs and traces: ids, request ids, model, effort, tokens, cost, latency, stop reasons, rounds, tool
  counts, `input_transformations` count. **Never** text, prompts, passages, queries or keys. SDK
  `logLevel: "warn"`.
- Limits: per-user questions per hour (existing limiter, `CHAT_RATE_LIMIT_PER_HOUR`), web searches per day
  for free users (`WEB_SEARCH_DAILY_LIMIT_FREE`, 10), `max_uses` 3 per answer, message ≤ 8,000 characters,
  ≤ 4 images per message (≤ 2,576 px long edge, re-encoded once before the first send).

## 11. Images attached to a message

Uploaded to `chat-attachments/{userId}/{chatId}/{id}.webp` (downscaled once in the browser), sent as base64
`image` blocks **before** the user's text. The stored bytes are what's re-sent every later turn (never
re-encoded, notes §4). Adding an image resets the chat's cache from `system` on (notes §8): the composer
doesn't warn; the usage view shows it.

## 12. Models and effort

- Registry (C1): `GET /v1/models` filtered by `CHAT_MODEL_ALLOWLIST`, tiers Fast (Haiku 5.5) · Balanced
  (Sonnet 5.5, default) · Best (Opus 5.5), cached 1 h, static fallback.
- A chat keeps its model and effort until the person changes them. A change applies from the next message
  with a tiny note "New model applies from your next message" (`notice model_changed`). History is sent
  unchanged; thinking the new model can't read is dropped by the API, unbilled (notes §4).

## 13. Acceptance (milestone)

1. "hi" → short natural reply, no `search_sources` call, no citations, first token < 1.5 s on Fast.
2. A general question without sources → rich Markdown (code, math, a diagram when useful).
3. After a PDF is processed: 4–5 suggested questions; clicking one streams an answer whose chips open the
   right page and passage.
4. "Show me the architecture figure" → the paper's figure inline with its citation.
5. Second identical question in pack mode → `cache_read_input_tokens > 0`.
6. A 3-turn chat with thinking and web search replays its raw history unchanged (no 400, zero
   `input_transformations`).
7. Stop → Continue completes the answer; a mid-stream `overloaded_error` fixture → interrupted → Continue.
8. No level selector anywhere.

# Claude API notes for the chat engine

Read on 2026-11-20 from platform.claude.com/docs (the `.md` versions of each page) and the Claude API
skill bundled with Claude Code. Every fact below has its source URL. **[unconfirmed]** marks things the
docs didn't settle; the chat engine spec (`docs/specs/chat-engine.md`) says how each one gets verified.

Base URL for links: `https://platform.claude.com/docs/en/`.

## 1. SDK, versions, auth

Source: `cli-sdks-libraries/sdks/typescript`, `api/errors`.

- Package `@anthropic-ai/sdk` (latest on npm: **1.11.0**, 2026-11-19). SDK 1.x sends API version
  **`2026-10-21`**; on that version `temperature`/`top_p`/`top_k` return a 400 on every model.
- Node 20 LTS+ supported. Browser use is disabled unless `dangerouslyAllowBrowser` (we never set it).
- Retries: 2 by default (`maxRetries`) on connection errors, 408, 409, 429, ≥500; honours `retry-after`.
  Timeout default 10 min (TypeScript: **milliseconds**); a timeout throws `APIConnectionTimeoutError` and is
  retried too.
- Error classes: `BadRequestError` 400, `AuthenticationError` 401, `PermissionDeniedError` 403,
  `NotFoundError` 404, `ConflictError` 409, `UnprocessableEntityError` 422, `RateLimitError` 429,
  `InternalServerError` ≥500, `APIConnectionError` (no status). All extend `Anthropic.APIError` (`status`,
  `headers`). Catch most-specific first; never string-match messages (one exception, section 9).
- Request id: `_request_id` on every response object (from the `request-id` header); errors carry
  `request_id` in the body. `.withResponse()` gives raw headers.
- **Logging:** `logLevel: "debug"` logs request and response **bodies**. We set `logLevel: "warn"` (default)
  explicitly and never debug in production (the P4.15 leak was exactly this class of bug).
- Streaming: `client.messages.stream(...)` → `MessageStream` with `.on("text")`, async iteration over raw
  events, `finalMessage()` (accumulates the exact final `Message`), `stream.abort()`. Beta features use
  `client.beta.messages.stream(...)` with `betas: [...]`.

## 2. Models

Source: `models/overview`, `about-claude/pricing`.

| | Claude Haiku 5.5 | Claude Sonnet 5.5 | Claude Opus 5.5 |
|---|---|---|---|
| ID | `claude-haiku-5-5` | `claude-sonnet-5-5` | `claude-opus-5-5` |
| Latency | Fastest | Fast | Moderate |
| Thinking | Adaptive (can be disabled) | Adaptive (`between_tools` to switch off up-front thinking; `disabled` is a 400) | Adaptive, always on |
| **Default effort** | `medium` | **`high`** | `medium` |
| Context / max output | 1M / 128K | 1M / 128K | 1M / 128K |
| Knowledge cutoff | Jun 2026 | Jun 2026 | Jun 2026 |

- Models API (`GET /v1/models`, SDK `client.models.list()` auto-paginates): each model has `id`,
  `display_name`, `created_at`, `max_input_tokens`, `max_tokens`, `line` (e.g. `opus`; use it to group in a
  picker, don't parse ids), and `capabilities` including `thinking.types.disabled.supported`,
  `thinking.types.between_tools.supported`, `server_tools.web_search.supported`,
  `server_tools.code_execution.supported`, `code_execution.supported`.
  **[unconfirmed]** field names for citations/effort/image capabilities: read a live response in C1.
- All current models: text + image input, vision, tool use, citations, search results.
- Forced tool use (`tool_choice` `any`/`tool`) is a **400** on Opus 5.5 and Sonnet 5.5 (`api/errors`). Use
  `auto` (or `none`). No assistant prefill on any of the three (400).

## 3. Thinking and effort

Sources: `build-with-claude/thinking`, `api/errors`, `models/overview`.

- On Claude 5+ thinking is on with no configuration, but `display` defaults to **`"omitted"`** (empty
  thinking text). To show a "Thinking" section: `thinking: {type: "adaptive", display: "summarized"}`. The
  text is always a summary, never the raw chain of thought.
- Thinking tokens are billed as **output** and count toward `max_tokens` (both with `omitted` and
  `summarized`). A `max_tokens` stop can come from thinking alone.
- Effort: `output_config: {effort: "low"|"medium"|"high"|"xhigh"|"max"}`. Setting it explicitly to the
  model's default doesn't invalidate the cache; changing it mid-conversation can (`prompt-caching`). A beta
  per-message effort system message avoids the reset (`effort-per-message`, beta
  `mid-conversation-output-config-2026-07-01`) **[not used in v1]**.
- Streaming: `thinking_delta` events carry the summary text; a `signature_delta` arrives just before the
  block's `content_block_stop` (`streaming`).

## 4. Preserved thinking (the rule that shapes the history design)

Sources: `build-with-claude/preserved-thinking`, `…/preserved-thinking/prefix-checks`,
`…/preserved-thinking/change-tools-or-instructions`.

- Applies to **Haiku 5.5, Sonnet 5.5, Opus 5.5** (and Fable/Mythos 5.1–5.2). Each thinking block records a
  fingerprint of everything before it: `system`, `tools`, and every earlier message.
- **A change before a thinking block fails the "prefix check".** On Opus/Sonnet/Haiku 5.5 the result is a
  *possible 400* ("…The block is bound to a different conversation…") **or** silent acceptance of stale
  reasoning. Changes that count: editing, inserting, moving or deleting an earlier message (any role);
  changing `system`; adding/removing/rewording a tool (one word of a description is enough); leaving out a
  thinking block between others. Changes that don't count: `model`, `effort`, `max_tokens`, `tool_choice`,
  `thinking.display`, `cache_control` markers, JSON key order.
- **The three habits of an append-only integration:** (1) send each assistant turn back exactly as returned,
  including empty-text thinking blocks; (2) build `system` and `tools` once per conversation and send that
  copy every time; (3) put every update in a new message at the end and leave it there.
- Changing instructions → append a `role: "system"` message after the newest user message (accepted by all
  three 5.5 models; it also doesn't invalidate the cache). Changing context (date, files) → a text block in
  the user message being sent.
- **Untrusted text** (files other people can edit) → only inside a `tool_result` block; append the pair
  yourself: an `assistant` message with a `tool_use` block, then a `user` message with the `tool_result`.
- Tools: keep `tools` identical; to add/remove one mid-chat append a system message with a `tool_addition`
  / `tool_removal` block (betas `mid-conversation-tool-changes-2026-07-01` for tools declared up front with
  `defer_loading: true`, or `inline-tools-2026-09-15`). `tool_choice: {type: "none"}` turns all tools off for
  one request without changing `tools`. **[unconfirmed]** whether server tools (web search) accept
  `defer_loading`.
- Trimming/summarising: your own summary or cut invalidates the kept turns' thinking (remove it or send
  `drop_block`). Server-side **compaction** (beta `compact-2026-01-12`) keeps it valid.
- Regenerating the last answer or editing the **last** user message only changes what comes after the
  thinking we keep, so it's safe. Editing an earlier message is not.
- Model switches never error: a block the new model can't read is dropped, unbilled. Sonnet 5.5 → Haiku 5.5
  loses Sonnet's blocks; Haiku 5.5 → Sonnet/Opus 5.5 keeps them; Opus 5.5 → Sonnet/Haiku 5.5 loses them.
  Keep one history for all models.
- Recovery: beta header `thinking-binding-controls-2026-08-01` + `thinking.block_binding.
  prefix_mismatch_behavior: "drop_block"` drops failing blocks (unbilled, but costs quality/cache). Without
  setting it, the response's `input_transformations` array (with the header) lists blocks that failed.
- Thinking blocks from Sonnet 5.5 and Haiku 5.5 work only in the producing organization.
- Images: shorten/downscale before the **first** send; re-encoding later is a change. A fresh signed URL for
  the same bytes is fine (the API compares fetched bytes).

## 5. Search results and citations

Sources: `build-with-claude/search-results`, `build-with-claude/citations`.

- Block: `{type: "search_result", source, title, content: [{type: "text", text}, ...], citations:
  {enabled: true}, cache_control?}`. `source` is any stable string (we use `tensorlm://chunk/<id>`). Text
  only (no images). Supported on all three models; no beta header.
- Allowed only in **user** messages: top-level user content or inside `tool_result` content. A
  `tool_result` that contains one `search_result` must contain only `search_result` blocks (else validation
  error). An empty search returns a plain text `tool_result` such as "No results found.".
- **Citations are all-or-nothing** per request: every `search_result` must have the same `citations`
  setting. With web search in the same request, they must all be enabled.
- Response: the answer is split into several `text` blocks; cited ones carry `citations: [...]` of type
  `search_result_location`: `{cited_text, source, title, search_result_index, start_block_index,
  end_block_index}`. `search_result_index` is 0-based **across all `search_result` blocks in the request, in
  order (all messages and tool results)**. Block indices slice the result's `content` (end exclusive): a
  text block is the smallest citable unit, so split passages into smaller blocks for finer citations.
- `cited_text` doesn't count toward output tokens, nor toward input when passed back.
- Streaming: `content_block_delta` with `delta: {type: "citations_delta", citation: {...}}`, one citation
  per delta, attached to the current text block.
- **Citations + structured outputs (`output_config.format`) = 400.** Helpers that need JSON run as separate
  calls without sources.
- Other location types: `char_location`, `page_location` (1-indexed, end exclusive),
  `content_block_location` for `document` blocks; `web_search_result_location` for web search.

## 6. Streaming

Source: `build-with-claude/streaming`.

- Order: `message_start` → per block `content_block_start` / `content_block_delta`* / `content_block_stop`
  → one or more `message_delta` (stop reason; **usage is cumulative**) → `message_stop`; `ping` anywhere.
  Some blocks arrive whole with no deltas: `redacted_thinking`, server tool results
  (`web_search_tool_result`), `fallback`.
- Delta types: `text_delta`, `input_json_delta` (partial JSON; parse at block stop), `thinking_delta`,
  `signature_delta`, `citations_delta`.
- **Unknown event types must be ignored** (versioning policy).
- Mid-stream errors arrive as `event: error` with `{"type": "error", "error": {"type":
  "overloaded_error", ...}}` inside a 200 response. **[unconfirmed]** exactly how the TypeScript
  `MessageStream` surfaces it (thrown from iteration/`finalMessage()` as an `APIError`?): pinned down with a
  fake stream in C4.
- **Recovery on Claude 4.6+:** keep the partial text; send a new **user** message such as "Your previous
  response was interrupted and ended with [previous_response]. Continue from where you left off." (no
  assistant prefill). Thinking and tool-use blocks can't be partially recovered; resume from the latest text.

## 7. Tools

Sources: Claude API skill (`shared/tool-use-concepts.md`, `typescript/claude-api/streaming.md`),
`agents-and-tools/tool-use/web-search-tool`.

- Client tools: `{name, description, input_schema, strict?: true, eager_input_streaming?: true}`. With
  streaming + client tools set `eager_input_streaming: true` and validate the parsed input yourself (the
  tolerant parser can return truncated input). Check `stop_reason` (`max_tokens`, `refusal`) before running
  a tool. Return all `tool_result`s of one assistant turn in one user message; failures as `is_error: true`.
- **Web search** (`web_search_20250305` basic, `web_search_20260209` dynamic filtering, `web_search_20260318`
  adds `response_inclusion`): all three 5.5 models supported; `max_uses`, `allowed_domains` *or*
  `blocked_domains`, `user_location`. On `…20260209`+ `allowed_callers` defaults to code execution (dynamic
  filtering, no extra charge); `allowed_callers: ["direct"]` calls it directly. Org admins can disable web
  search: then requests with the tool get a 400 `invalid_request_error`.
- Web search blocks: `server_tool_use {id, name: "web_search", input: {query}}` then
  `web_search_tool_result {tool_use_id, content: [web_search_result {url, title, encrypted_content,
  page_age}]}` or an **error object** (`{type: "web_search_tool_result_error", error_code:
  too_many_requests|invalid_tool_input|max_uses_exceeded|query_too_long|request_too_large|unavailable}`) with
  HTTP 200. `encrypted_content` and `encrypted_index` must be sent back unchanged (else 400).
- Web citations: `web_search_result_location {url, title, encrypted_index, cited_text (≤150 chars)}`; always
  on; must be shown to end users.
- `pause_turn`: send the paused assistant message back unchanged to continue. If Claude calls web search
  and a client tool in the same parallel group, the API returns `tool_use` and runs the search next request.
- Usage: `usage.server_tool_use.web_search_requests`; price **$10 per 1,000 searches** + tokens; failed
  searches aren't billed.
- Server-side refusal fallbacks (beta `server-side-fallback-2026-07-01`, `fallbacks: "default"`) re-run a
  refused turn on a fallback model inside the same call (Sonnet 5.5, Opus 5.5; Haiku 5.5 has none). The
  turn then holds a `fallback` block with its own history rules. **[unconfirmed]** details: read
  `build-with-claude/refusals-and-fallback` before enabling (C4).

## 8. Prompt caching

Source: `build-with-claude/prompt-caching`.

- Prefix order `tools` → `system` → `messages`. Up to **4 breakpoints**. Automatic caching = top-level
  `cache_control: {type: "ephemeral"}`, uses one slot, moves forward with the conversation.
- TTL 5 min (write 1.25×) or `ttl: "1h"` (write 2×). **1h breakpoints must come before 5m ones.** Reads:
  0.05× base on Sonnet/Opus 5.5, 0.1× on Haiku 5.5.
- Minimum cacheable prefix: **512 tokens** on all three 5.5 models; shorter prefixes silently don't cache.
- Lookback: 20 positions per breakpoint (a run of `tool_use` or `tool_result` blocks counts as one); add a
  second breakpoint in very long chats.
- Usage: `cache_creation_input_tokens`, `cache_read_input_tokens`, `input_tokens` (after the last
  breakpoint), split `cache_creation.ephemeral_5m_input_tokens` / `ephemeral_1h_input_tokens`.
- Invalidation: tool definitions (everything); **web search or citations toggle** (system + messages);
  `tool_choice` (messages); **adding or removing images** (system + messages); thinking parameters and
  effort (model-specific). Appending a `role: "system"` message doesn't invalidate.
- Thinking blocks can't carry `cache_control`; they're cached as part of the content.
- **[unconfirmed]** whether caches are scoped per model (the skill says they are; the page doesn't say).

## 9. Errors

Source: `api/errors`.

| Status | Type | Note |
|---|---|---|
| 400 | `invalid_request_error` | Also returned when an **organization or workspace spend limit you set** is reached **[unconfirmed: exact message text]** |
| 401 | `authentication_error` | |
| 402 | `billing_error` | |
| 403 | `permission_error` | |
| 404 | `not_found_error` | |
| 413 | `request_too_large` | Messages API max 128 MB per request |
| 429 | `rate_limit_error` | Rate limit (has `retry-after`), **or tier monthly spend cap: no `retry-after`, keeps failing** |
| 500 | `api_error` | Retry with backoff; `timeout_error` can also come as 500 |
| 504 | `timeout_error` | |
| 529 | `overloaded_error` | Also arrives mid-stream as an `error` event |

Error body: `{type: "error", error: {type, message}, request_id}`. Other documented 400s we can hit:
"bound to a different conversation" (prefix check), "thinking … cannot be modified", prefill not supported,
`tool_choice` any/tool not supported, `block_binding` without its beta header.

## 10. Structured outputs (helper calls)

Source: `build-with-claude/structured-outputs`.

- `output_config: {format: {type: "json_schema", schema}}`; Haiku 5.5 supported. SDK helper
  `client.messages.parse({..., output_config: {format: zodOutputFormat(schema)}})` from
  `@anthropic-ai/sdk/helpers/zod` → `parsed_output`.
- Schema limits: objects need `additionalProperties: false`; **no `minLength`/`maxLength`, no
  `minimum`/`maximum`, no `maxItems`, `minItems` only 0 or 1, no `oneOf`**. The zod helper moves such
  constraints into descriptions and validates them locally — so "4–5 questions, ≤ 90 characters" is enforced
  by our zod validation, not the grammar.
- First use of a schema compiles a grammar (extra latency); cached 24 h.

## 11. Vision

Source: `build-with-claude/vision`.

- JPEG, PNG, GIF (first frame), WebP. Source `base64`, `url`, or `file` (Files API). Images before text
  work best.
- Max 600 images per request (1M-context models), 8000×8000 px, **10 MB per image (base64)**; with more than
  20 images a stricter per-image limit applies (keep ≤ 3000 px).
- Cost: `⌈w/28⌉ × ⌈h/28⌉` tokens; 5.5 models use the high-resolution tier (long edge ≤ 2,576 px, ≤ 4,784
  tokens). Downscale before sending: the first send fixes the bytes (section 4).

## 12. Pricing (USD per million tokens, Claude API, 2026-11-20)

Source: `about-claude/pricing`. To be confirmed by the product owner before C1 ships it.

| Model | Input | 5m cache write | 1h cache write | Cache read | Output |
|---|---|---|---|---|---|
| Claude Opus 5.5 | 4.00 | 5.00 | 8.00 | 0.20 | 20.00 |
| Claude Sonnet 5.5 | 2.00 | 2.50 | 4.00 | 0.10 | 10.00 |
| Claude Haiku 5.5 (prompt ≤ 100K) | 0.10 | 0.125 | 0.20 | 0.01 | 0.50 |
| Claude Haiku 5.5 (prompt > 100K) | 0.50 | 0.625 | 1.00 | 0.05 | 2.50 |

- Haiku 5.5's prompt length counts all input incl. cache reads/writes; each request priced on its own.
- Thinking is billed as output. Web search: $10 / 1,000 searches. US-only `inference_geo`: 1.1× (we don't
  use it).

## 13. Token counting

Source: Claude API skill (`shared/token-counting.md`), SDK reference.

- `client.messages.countTokens({model, system, tools, messages})` → `{input_tokens}`. Same 400s as
  messages for unsupported `tool_choice`. Don't estimate with other tokenizers.

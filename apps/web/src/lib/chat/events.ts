/**
 * The browser-facing chat stream protocol (contracts/chat-events.json, spec
 * docs/specs/chat-engine.md section 6). The server sends Server-Sent Events whose `event:` is the
 * event type and whose `data:` is one JSON object; the browser validates each one here and ignores
 * event types it doesn't know (the protocol can grow without breaking older tabs).
 *
 * Safe for client and server code: no secrets, no SDK imports.
 */
import { z } from "zod";
import { CHAT_EVENTS } from "./events.generated";

type Contract = typeof CHAT_EVENTS;
export type ChatEventType = keyof Contract["events"];
export type Stage = keyof Contract["stages"];
export type Effort = Contract["efforts"][number];
export type StopReason = Contract["stopReasons"][number];
export type NoticeCode = keyof Contract["notices"];
export type ChatErrorCode = keyof Contract["errors"];

export const PROTOCOL_VERSION = CHAT_EVENTS.version;
export const CHAT_LIMITS = CHAT_EVENTS.limits;
export const EFFORTS = CHAT_EVENTS.efforts;

const keysOf = <T extends object>(o: T) =>
  Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const Id = z.uuid();
const Count = z.int().nonnegative();
const StageSchema = z.enum(keysOf(CHAT_EVENTS.stages));
const EffortSchema = z.enum(CHAT_EVENTS.efforts);
const StopReasonSchema = z.enum(CHAT_EVENTS.stopReasons);
const NoticeSchema = z.enum(keysOf(CHAT_EVENTS.notices));
const ErrorCodeSchema = z.enum(keysOf(CHAT_EVENTS.errors));
const ToolKindSchema = z.enum(CHAT_EVENTS.toolKinds);

const Range = z.strictObject({ start: z.number().nonnegative(), end: z.number().nonnegative() });
const BBox = z.strictObject({
  page: z.int().positive(),
  l: z.number(),
  t: z.number(),
  r: z.number(),
  b: z.number(),
});

/** A citation mapped server-side from Claude's search_result_location / web_search_result_location. */
export const CitationSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("source"),
    number: z.int().positive(),
    documentId: Id,
    documentTitle: z.string().min(1),
    chunkId: Id.optional(),
    figureId: Id.optional(),
    sourceType: z.string().optional(),
    page: Range.optional(),
    slide: z.int().positive().optional(),
    seconds: Range.optional(),
    sheet: z.string().optional(),
    bboxes: z.array(BBox).optional(),
    citedText: z.string(),
  }),
  z.strictObject({
    kind: z.literal("web"),
    number: z.int().positive(),
    url: z.url({ protocol: /^https?$/ }),
    title: z.string(),
    citedText: z.string(),
  }),
]);
export type MappedCitation = z.infer<typeof CitationSchema>;

/** One schema per event type. Field names and optionality must match the contract (tested). */
export const EVENT_SCHEMAS = {
  start: z.strictObject({
    protocol: z.int(),
    chatId: Id,
    notebookId: Id.optional(),
    userMessageId: Id,
    messageId: Id,
    model: z.string().min(1),
    effort: EffortSchema,
  }),
  status: z.strictObject({ stage: StageSchema, detail: z.string().optional() }),
  thinking_delta: z.strictObject({ text: z.string() }),
  thinking_done: z.strictObject({ seconds: z.number().nonnegative() }),
  tool_activity: z.strictObject({
    id: z.string().min(1),
    kind: ToolKindSchema,
    query: z.string(),
    resultCount: Count.optional(),
  }),
  text_delta: z.strictObject({ blockIndex: Count, text: z.string() }),
  citation: z.strictObject({ blockIndex: Count, citation: CitationSchema }),
  figure: z.strictObject({
    figureId: Id,
    url: z.string().min(1),
    label: z.string(),
    page: z.int().positive().optional(),
    documentId: Id,
  }),
  notice: z.strictObject({ code: NoticeSchema }),
  usage: z.strictObject({
    inputTokens: Count,
    outputTokens: Count,
    cacheReadTokens: Count,
    cacheWriteTokens: Count,
    webSearches: Count,
    costUsd: z.number().nonnegative(),
  }),
  done: z.strictObject({ messageId: Id, stopReason: StopReasonSchema }),
  error: z.strictObject({
    code: ErrorCodeSchema,
    message: z.string().min(1),
    fix: z.string().min(1),
    retryable: z.boolean(),
  }),
  followups: z.strictObject({ messageId: Id, questions: z.array(z.string().min(1)) }),
  title: z.strictObject({ chatId: Id, title: z.string().min(1) }),
} satisfies Record<ChatEventType, z.ZodType>;

type Schemas = typeof EVENT_SCHEMAS;
export type ChatEvent = {
  [K in ChatEventType]: { type: K; data: z.infer<Schemas[K]> };
}[ChatEventType];
export type ChatEventData<K extends ChatEventType> = z.infer<Schemas[K]>;

export function isChatEventType(type: string): type is ChatEventType {
  return Object.hasOwn(EVENT_SCHEMAS, type);
}

/**
 * Validates one received event. Returns null for unknown types (ignored by design) and for data that
 * doesn't match its schema (a bug or a newer server: the caller logs the type and moves on).
 */
export function parseChatEvent(type: string, data: unknown): ChatEvent | null {
  if (!isChatEventType(type)) return null;
  const parsed = EVENT_SCHEMAS[type].safeParse(data);
  return parsed.success ? ({ type, data: parsed.data } as ChatEvent) : null;
}

/** One SSE frame. The server validates before sending, so a bad event fails loudly in tests. */
export function encodeChatEvent<K extends ChatEventType>(type: K, data: ChatEventData<K>): string {
  const checked = EVENT_SCHEMAS[type].parse(data);
  return `event: ${type}\ndata: ${JSON.stringify(checked)}\n\n`;
}

/** Learner copy for an error code; unknown codes read as `internal`. */
export function chatErrorCopy(code: string | null | undefined) {
  const known = (
    code != null && Object.hasOwn(CHAT_EVENTS.errors, code) ? code : "internal"
  ) as ChatErrorCode;
  return { code: known, ...CHAT_EVENTS.errors[known] };
}

export function noticeText(code: NoticeCode): string {
  return CHAT_EVENTS.notices[code];
}

export function stageText(stage: Stage): string {
  return CHAT_EVENTS.stages[stage];
}

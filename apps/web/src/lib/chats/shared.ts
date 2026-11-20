/**
 * Chat vocabulary shared by the server and the UI. Message parts follow the AI SDK UI message
 * format; citations follow docs/specs/answers.md §5.
 */
import { z } from "zod";
import {
  feedbackReasonSchema,
  levelSchema,
  LIMITS,
  type AnswerMode,
  type Level,
} from "@/lib/answers/format";
import type { Database } from "@/lib/database.types";

export type ChatRow = Database["public"]["Tables"]["chats"]["Row"];
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

export type Chat = Pick<
  ChatRow,
  "id" | "notebook_id" | "title" | "title_generated" | "level" | "created_at" | "last_message_at"
>;

export type Citation = {
  n: number;
  chunk_id: string;
  document_id: string;
  document_title: string;
  page_start: number | null;
  page_end: number | null;
  bboxes: { page: number; l: number; t: number; r: number; b: number }[];
  kind: string;
  figure_id: string | null;
  section: string | null;
  quote_preview: string;
};

export type Attachment = { document_id: string; page: number; text: string };

export type MessageStatus = "streaming" | "complete" | "stopped" | "error";

/** What the client renders for one stored message. */
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  status: MessageStatus;
  errorCode: string | null;
  level: Level | null;
  mode: AnswerMode | null;
  command: string | null;
  citations: Citation[];
  followups: string[];
  parentId: string | null;
  version: number;
  attachments: Attachment[];
  flags: { ungrounded?: boolean };
  createdAt: string;
};

export const CHAT_FIELDS =
  "id, notebook_id, title, title_generated, level, created_at, last_message_at";
export const MESSAGE_FIELDS =
  "id, role, content, status, error_code, level, mode, command, citations, followups, parent_id, version, parts, flags, created_at";

export function toChatMessage(
  row: Pick<
    MessageRow,
    | "id"
    | "role"
    | "content"
    | "status"
    | "error_code"
    | "level"
    | "mode"
    | "command"
    | "citations"
    | "followups"
    | "parent_id"
    | "version"
    | "parts"
    | "flags"
    | "created_at"
  >,
): ChatMessage {
  const parts = Array.isArray(row.parts) ? (row.parts as { type?: string; data?: unknown }[]) : [];
  const attachments = parts
    .filter((p) => p.type === "data-attachment")
    .map((p) => p.data as Attachment);
  return {
    id: row.id,
    role: row.role as "user" | "assistant",
    text: row.content,
    status: row.status as MessageStatus,
    errorCode: row.error_code,
    level: row.level as Level | null,
    mode: row.mode as AnswerMode | null,
    command: row.command,
    citations: (Array.isArray(row.citations) ? row.citations : []) as Citation[],
    followups: row.followups ?? [],
    parentId: row.parent_id,
    version: row.version,
    attachments,
    flags: (row.flags ?? {}) as { ungrounded?: boolean },
    createdAt: row.created_at,
  };
}

// ───────────── Inputs ─────────────

export const chatIdSchema = z.strictObject({ id: z.uuid() });
export const createChatSchema = z.strictObject({
  notebookId: z.uuid(),
  level: levelSchema.optional(),
});
export const renameChatSchema = z.strictObject({
  id: z.uuid(),
  title: z.string().trim().min(1, "Give the chat a name.").max(120, "Use 120 characters or fewer."),
});
export const chatLevelSchema = z.strictObject({ id: z.uuid(), level: levelSchema });

export const feedbackSchema = z.strictObject({
  messageId: z.uuid(),
  rating: z.enum(["up", "down"]),
  reason: feedbackReasonSchema.nullable().optional(),
  comment: z.string().trim().max(1000).nullable().optional(),
});

export const noteSchema = z.strictObject({
  notebookId: z.uuid(),
  chatId: z.uuid().nullable().optional(),
  messageId: z.uuid().nullable().optional(),
  documentId: z.uuid().nullable().optional(),
  page: z.number().int().min(1).nullable().optional(),
  quote: z.string().max(4000).nullable().optional(),
  body: z.string().max(20000).nullable().optional(),
});

export const sourceIncludedSchema = z.strictObject({ documentId: z.uuid(), included: z.boolean() });

export const attachmentSchema = z.strictObject({
  document_id: z.uuid(),
  page: z.number().int().min(1),
  text: z.string().trim().min(1).max(LIMITS.quoteChars),
});

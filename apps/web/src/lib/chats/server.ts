import "server-only";
/**
 * Chats and messages on the server. Chats are read and changed with the caller's client (RLS: a
 * chat someone else owns is a 404). Messages are written only here, with the service-role client,
 * after the chat's ownership was checked, so stored citations, usage and status can't be forged.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/database.types";
import type { Database } from "@/lib/database.types";
import { notFound } from "@/lib/errors";
import type { AnswerMode, Level } from "@/lib/answers/format";
import { getNotebook } from "@/lib/notebooks/repo";
import {
  CHAT_FIELDS,
  MESSAGE_FIELDS,
  toChatMessage,
  type Attachment,
  type Chat,
  type ChatMessage,
  type Citation,
} from "./shared";

type Db = SupabaseClient<Database>;

/** A streaming row older than this was cut off (crash, closed tab): it becomes "stopped". */
export const STALE_STREAMING_MS = 2 * 60 * 1000;

// ───────────── Chats (caller's client) ─────────────

export async function listChats(db: Db, notebookId: string): Promise<Chat[]> {
  const { data, error } = await db
    .from("chats")
    .select(CHAT_FIELDS)
    .eq("notebook_id", notebookId)
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as Chat[];
}

export async function getChat(db: Db, id: string): Promise<Chat & { user_id: string }> {
  const { data, error } = await db
    .from("chats")
    .select(`${CHAT_FIELDS}, user_id`)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("We couldn't find that chat.");
  return data as Chat & { user_id: string };
}

export async function createChat(db: Db, userId: string, notebookId: string, level: Level) {
  if (!(await getNotebook(db, notebookId))) throw notFound("We couldn't find that notebook.");
  const { data, error } = await db
    .from("chats")
    .insert({ notebook_id: notebookId, user_id: userId, level })
    .select(CHAT_FIELDS)
    .single();
  if (error) throw error;
  return data as Chat;
}

export async function renameChat(db: Db, id: string, title: string) {
  const { data, error } = await db
    .from("chats")
    .update({ title, title_generated: false })
    .eq("id", id)
    .is("deleted_at", null)
    .select(CHAT_FIELDS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("We couldn't find that chat.");
  return data as Chat;
}

export async function setChatLevel(db: Db, id: string, level: Level) {
  const { error, data } = await db
    .from("chats")
    .update({ level })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("We couldn't find that chat.");
}

export async function softDeleteChat(db: Db, id: string, deleted: boolean) {
  const { data, error } = await db
    .from("chats")
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("We couldn't find that chat.");
}

/** Messages, oldest first. Repairs rows left "streaming" by a crash (text kept, "stopped"). */
export async function listMessages(
  db: Db,
  admin: Db,
  chatId: string,
  limit = 200,
): Promise<ChatMessage[]> {
  const { data, error } = await db
    .from("messages")
    .select(MESSAGE_FIELDS)
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []).reverse();
  const cutoff = Date.now() - STALE_STREAMING_MS;
  const stale = rows.filter((r) => r.status === "streaming" && Date.parse(r.created_at) < cutoff);
  if (stale.length > 0) {
    await admin
      .from("messages")
      .update({ status: "stopped" })
      .in(
        "id",
        stale.map((r) => r.id),
      )
      .eq("status", "streaming");
    for (const r of stale) r.status = "stopped";
  }
  return rows.map(toChatMessage);
}

// ───────────── Messages (service role, after an ownership check) ─────────────

type Owner = { chatId: string; userId: string };

export async function saveUserMessage(
  admin: Db,
  { chatId, userId }: Owner,
  input: {
    text: string;
    level: Level;
    command: string | null;
    attachments: Attachment[];
    documentIds: string[];
  },
) {
  const parts = [
    { type: "text", text: input.text },
    ...input.attachments.map((a) => ({ type: "data-attachment", data: a })),
  ];
  const { data, error } = await admin
    .from("messages")
    .insert({
      chat_id: chatId,
      user_id: userId,
      role: "user",
      content: input.text,
      parts: parts as unknown as NonNullable<Json>,
      status: "complete",
      level: input.level,
      command: input.command,
      selected_document_ids: input.documentIds,
    })
    .select("id")
    .single();
  if (error) throw error;
  await touchChat(admin, chatId);
  return data.id;
}

export async function startAssistantMessage(
  admin: Db,
  { chatId, userId }: Owner,
  input: {
    parentId: string;
    level: Level;
    mode: AnswerMode;
    command: string | null;
    documentIds: string[];
    model: string;
    promptVersion: string;
  },
) {
  const { data: versions, error: vErr } = await admin
    .from("messages")
    .select("version")
    .eq("parent_id", input.parentId)
    .order("version", { ascending: false })
    .limit(1);
  if (vErr) throw vErr;
  const { data, error } = await admin
    .from("messages")
    .insert({
      chat_id: chatId,
      user_id: userId,
      role: "assistant",
      content: "",
      status: "streaming",
      parent_id: input.parentId,
      version: (versions?.[0]?.version ?? 0) + 1,
      level: input.level,
      mode: input.mode,
      command: input.command,
      selected_document_ids: input.documentIds,
      model: input.model,
      prompt_version: input.promptVersion,
    })
    .select("id, version")
    .single();
  if (error) throw error;
  return data;
}

/** Saves partial text while streaming, so a crash keeps what was written. */
export async function checkpointAssistant(admin: Db, id: string, text: string) {
  await admin.from("messages").update({ content: text }).eq("id", id).eq("status", "streaming");
}

export type Finished = {
  text: string;
  citations: Citation[];
  usage: Record<string, number> | null;
  latencyMs: number;
  followups?: string[];
  flags?: Record<string, unknown>;
};

export async function finishAssistant(
  admin: Db,
  id: string,
  status: "complete" | "stopped",
  done: Finished,
) {
  const { error } = await admin
    .from("messages")
    .update({
      status,
      content: done.text,
      parts: [{ type: "text", text: done.text }] as unknown as NonNullable<Json>,
      citations: done.citations as unknown as Json,
      usage: done.usage as unknown as Json,
      latency_ms: done.latencyMs,
      followups: done.followups ?? [],
      flags: (done.flags ?? {}) as NonNullable<Json>,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function setFollowups(admin: Db, id: string, followups: string[]) {
  await admin.from("messages").update({ followups }).eq("id", id);
}

export async function failAssistant(admin: Db, id: string, code: string, text: string) {
  await admin
    .from("messages")
    .update({ status: "error", error_code: code, content: text })
    .eq("id", id);
}

export async function touchChat(admin: Db, chatId: string) {
  await admin.from("chats").update({ last_message_at: new Date().toISOString() }).eq("id", chatId);
}

/** Sets the generated title unless the person renamed the chat meanwhile. */
export async function setGeneratedTitle(admin: Db, chatId: string, title: string) {
  const { data } = await admin
    .from("chats")
    .update({ title })
    .eq("id", chatId)
    .eq("title_generated", true)
    .is("title", null)
    .select("id");
  return (data ?? []).length > 0;
}

export async function getMessage(admin: Db, chatId: string, id: string) {
  const { data, error } = await admin
    .from("messages")
    .select(`${MESSAGE_FIELDS}, chat_id`)
    .eq("id", id)
    .eq("chat_id", chatId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("We couldn't find that message.");
  return data;
}

/** The last turns of a chat as plain text (newest last), for the prompt's history. */
export async function recentTurns(
  admin: Db,
  chatId: string,
  beforeId: string | null,
  turns: number,
) {
  let query = admin
    .from("messages")
    .select("id, role, content, status, created_at")
    .eq("chat_id", chatId)
    .in("status", ["complete", "stopped"])
    .order("created_at", { ascending: false })
    .limit(turns * 2 + 2);
  if (beforeId) {
    const { data: anchor } = await admin
      .from("messages")
      .select("created_at")
      .eq("id", beforeId)
      .maybeSingle();
    if (anchor) query = query.lt("created_at", anchor.created_at);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? [])
    .reverse()
    .filter((m) => m.content.trim().length > 0)
    .slice(-turns * 2)
    .map((m) => ({ role: m.role as "user" | "assistant", text: m.content }));
}

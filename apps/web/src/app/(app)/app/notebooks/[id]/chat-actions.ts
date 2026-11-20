"use server";

import { requireUserForApi } from "@/lib/auth";
import { profileLevel } from "@/lib/chats/level";
import * as chats from "@/lib/chats/server";
import {
  chatIdSchema,
  chatLevelSchema,
  createChatSchema,
  feedbackSchema,
  noteSchema,
  renameChatSchema,
  sourceIncludedSchema,
  type Chat,
} from "@/lib/chats/shared";
import { defineAction, notFound } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export const createChat = defineAction(createChatSchema, async ({ notebookId, level }) => {
  const user = await requireUserForApi();
  const db = await createClient();
  const chat = await chats.createChat(
    db,
    user.id,
    notebookId,
    level ?? (await profileLevel(db, user.id)),
  );
  return { ok: true, data: chat };
});

export const renameChat = defineAction(renameChatSchema, async ({ id, title }) => {
  await requireUserForApi();
  const chat = await chats.renameChat(await createClient(), id, title);
  return { ok: true, data: chat as Chat };
});

export const setChatLevel = defineAction(chatLevelSchema, async ({ id, level }) => {
  await requireUserForApi();
  await chats.setChatLevel(await createClient(), id, level);
  return { ok: true };
});

export const deleteChat = defineAction(chatIdSchema, async ({ id }) => {
  await requireUserForApi();
  await chats.softDeleteChat(await createClient(), id, true);
  return { ok: true, message: "Chat deleted" };
});

export const restoreChat = defineAction(chatIdSchema, async ({ id }) => {
  await requireUserForApi();
  await chats.softDeleteChat(await createClient(), id, false);
  return { ok: true };
});

/** 👍 / 👎 with an optional reason and comment. A new vote updates the same row. */
export const saveFeedback = defineAction(feedbackSchema, async (input) => {
  const user = await requireUserForApi();
  const db = await createClient();
  const { error } = await db.from("feedback").upsert(
    {
      user_id: user.id,
      message_id: input.messageId,
      rating: input.rating,
      reason: input.rating === "down" ? (input.reason ?? null) : null,
      comment: input.rating === "down" ? (input.comment ?? null) : null,
    },
    { onConflict: "user_id,message_id" },
  );
  if (error) throw notFound("We couldn't find that answer.");
  return { ok: true, message: "Thanks for the feedback" };
});

export const createNote = defineAction(noteSchema, async (input) => {
  const user = await requireUserForApi();
  const db = await createClient();
  const { data, error } = await db
    .from("notes")
    .insert({
      user_id: user.id,
      notebook_id: input.notebookId,
      chat_id: input.chatId ?? null,
      message_id: input.messageId ?? null,
      document_id: input.documentId ?? null,
      page: input.page ?? null,
      quote: input.quote ?? null,
      body: input.body ?? null,
    })
    .select("id")
    .single();
  if (error) throw notFound("We couldn't find that notebook.");
  return { ok: true, data: data.id, message: "Saved to notes" };
});

/** "Include in answers" on a source card. */
export const setSourceIncluded = defineAction(
  sourceIncludedSchema,
  async ({ documentId, included }) => {
    await requireUserForApi();
    const db = await createClient();
    const { data, error } = await db
      .from("documents")
      .update({ included })
      .eq("id", documentId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound("We couldn't find that source.");
    return { ok: true };
  },
);

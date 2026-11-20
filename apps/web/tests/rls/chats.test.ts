/**
 * Chats and messages (lib/chats/server.ts) as two people: CRUD and ownership, regenerate versions,
 * crash recovery of partial answers, and generated titles that never overwrite a rename.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as chats from "@/lib/chats/server";
import { AppError } from "@/lib/errors";
import { admin, must, person, type Person } from "./support";

let A: Person;
let B: Person;
let notebook = "";

const isNotFound = (e: unknown) => e instanceof AppError && e.status === 404;

beforeAll(async () => {
  A = await person("chata");
  B = await person("chatb");
  notebook = must(
    await A.client
      .from("notebooks")
      .insert({ user_id: A.user.id, title: "Chats" })
      .select("id")
      .single(),
  ).id;
});

afterAll(async () => {
  for (const p of [A, B]) if (p) await admin.auth.admin.deleteUser(p.user.id);
});

describe("chats", () => {
  it("create, list, rename, level, delete and restore", async () => {
    const chat = await chats.createChat(A.client, A.user.id, notebook, "beginner");
    expect(chat).toMatchObject({ level: "beginner", title: null, title_generated: true });
    expect((await chats.listChats(A.client, notebook)).map((c) => c.id)).toContain(chat.id);
    const renamed = await chats.renameChat(A.client, chat.id, "Attention questions");
    expect(renamed).toMatchObject({ title: "Attention questions", title_generated: false });
    await chats.setChatLevel(A.client, chat.id, "expert");
    expect((await chats.getChat(A.client, chat.id)).level).toBe("expert");
    await chats.softDeleteChat(A.client, chat.id, true);
    expect((await chats.listChats(A.client, notebook)).map((c) => c.id)).not.toContain(chat.id);
    await chats.softDeleteChat(A.client, chat.id, false);
    expect((await chats.listChats(A.client, notebook)).map((c) => c.id)).toContain(chat.id);
  });

  it("person B gets 404 for A's chats and can't start one in A's notebook", async () => {
    const chat = await chats.createChat(A.client, A.user.id, notebook, "intermediate");
    for (const run of [
      () => chats.getChat(B.client, chat.id),
      () => chats.renameChat(B.client, chat.id, "mine now"),
      () => chats.setChatLevel(B.client, chat.id, "expert"),
      () => chats.softDeleteChat(B.client, chat.id, true),
      () => chats.createChat(B.client, B.user.id, notebook, "beginner"),
    ]) {
      expect(
        isNotFound(
          await run().then(
            () => null,
            (e: unknown) => e,
          ),
        ),
      ).toBe(true);
    }
    expect(await chats.listMessages(B.client, admin, chat.id)).toEqual([]);
  });

  it("people can't write messages directly", async () => {
    const chat = await chats.createChat(A.client, A.user.id, notebook, "intermediate");
    const { error } = await A.client
      .from("messages")
      .insert({
        chat_id: chat.id,
        user_id: A.user.id,
        role: "assistant",
        content: "forged answer",
      });
    expect(error).not.toBeNull();
  });
});

describe("messages", () => {
  it("regenerating keeps the parent and counts versions", async () => {
    const chat = await chats.createChat(A.client, A.user.id, notebook, "intermediate");
    const owner = { chatId: chat.id, userId: A.user.id };
    const question = await chats.saveUserMessage(admin, owner, {
      text: "How does attention work?",
      level: "intermediate",
      command: null,
      attachments: [],
      documentIds: [],
    });
    const base = {
      parentId: question,
      level: "intermediate" as const,
      mode: "full_context" as const,
      command: null,
      documentIds: [],
      model: "m",
      promptVersion: "p",
    };
    const first = await chats.startAssistantMessage(admin, owner, base);
    await chats.finishAssistant(admin, first.id, "complete", {
      text: "First [1].",
      citations: [],
      usage: null,
      latencyMs: 10,
    });
    const second = await chats.startAssistantMessage(admin, owner, base);
    expect([first.version, second.version]).toEqual([1, 2]);
    await chats.finishAssistant(admin, second.id, "complete", {
      text: "Second.",
      citations: [],
      usage: null,
      latencyMs: 10,
    });
    const list = await chats.listMessages(A.client, admin, chat.id);
    expect(
      list.map((m) => [m.role, m.version, m.parentId === question || m.role === "user"]),
    ).toEqual([
      ["user", 1, true],
      ["assistant", 1, true],
      ["assistant", 2, true],
    ]);
  });

  it("a crash mid-answer keeps the partial text as stopped", async () => {
    const chat = await chats.createChat(A.client, A.user.id, notebook, "intermediate");
    const owner = { chatId: chat.id, userId: A.user.id };
    const q = await chats.saveUserMessage(admin, owner, {
      text: "Q",
      level: "beginner",
      command: null,
      attachments: [],
      documentIds: [],
    });
    const a = await chats.startAssistantMessage(admin, owner, {
      parentId: q,
      level: "beginner",
      mode: "retrieval",
      command: null,
      documentIds: [],
      model: "m",
      promptVersion: "p",
    });
    await chats.checkpointAssistant(admin, a.id, "Partial answer so far");
    // Simulate the process dying: the row stays "streaming" and ages past the cutoff.
    must(
      await admin
        .from("messages")
        .update({
          created_at: new Date(Date.now() - chats.STALE_STREAMING_MS - 1000).toISOString(),
        })
        .eq("id", a.id)
        .select("id"),
    );
    const list = await chats.listMessages(A.client, admin, chat.id);
    expect(list.find((m) => m.id === a.id)).toMatchObject({ status: "stopped", text: "Partial answer so far" });
  });

  it("a generated title never overwrites a rename", async () => {
    const chat = await chats.createChat(A.client, A.user.id, notebook, "intermediate");
    expect(await chats.setGeneratedTitle(admin, chat.id, "Multi-head attention")).toBe(true);
    const other = await chats.createChat(A.client, A.user.id, notebook, "intermediate");
    await chats.renameChat(A.client, other.id, "My own name");
    expect(await chats.setGeneratedTitle(admin, other.id, "Generated")).toBe(false);
    expect((await chats.getChat(A.client, other.id)).title).toBe("My own name");
  });

  it("feedback: one row per person per answer, a new vote updates it", async () => {
    const chat = await chats.createChat(A.client, A.user.id, notebook, "intermediate");
    const owner = { chatId: chat.id, userId: A.user.id };
    const q = await chats.saveUserMessage(admin, owner, {
      text: "Q",
      level: "beginner",
      command: null,
      attachments: [],
      documentIds: [],
    });
    const a = await chats.startAssistantMessage(admin, owner, {
      parentId: q,
      level: "beginner",
      mode: "retrieval",
      command: null,
      documentIds: [],
      model: "m",
      promptVersion: "p",
    });
    const vote = (rating: string, reason: string | null) =>
      A.client
        .from("feedback")
        .upsert(
          { user_id: A.user.id, message_id: a.id, rating, reason },
          { onConflict: "user_id,message_id" },
        );
    must(await vote("up", null).select("id"));
    must(await vote("down", "unclear").select("id"));
    const rows = must(await admin.from("feedback").select("rating, reason").eq("message_id", a.id));
    expect(rows).toEqual([{ rating: "down", reason: "unclear" }]);
    // Person B can't rate A's answer.
    const { error } = await B.client
      .from("feedback")
      .insert({ user_id: B.user.id, message_id: a.id, rating: "up" });
    expect(error).not.toBeNull();
  });
});

/**
 * The chat route's logic (lib/answers/respond.ts) end to end against the database, with mock
 * models: stream order, validated citations, persistence, cache breakpoints, level text, stop,
 * continue, regenerate, rate limit, ownership and upstream errors.
 */
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { respond, type ChatRequest, type RespondDeps } from "@/lib/answers/respond";
import * as chats from "@/lib/chats/server";
import { AppError } from "@/lib/errors";
import { admin, must, person, type Person } from "./support";

let A: Person;
let B: Person;
let notebook = "";
let documentId = "";

const usage = {
  inputTokens: { total: 1200, noCache: 200, cacheRead: 1000, cacheWrite: 0 },
  outputTokens: { total: 50, text: 50, reasoning: undefined },
};

/** A strong model that streams `deltas` (with an optional pause before the last one). */
function streaming(deltas: string[], seen: { prompt?: unknown[] } = {}, delayMs = 0) {
  return new MockLanguageModelV4({
    doStream: async (options) => {
      seen.prompt = options.prompt as unknown[];
      return {
        stream: simulateReadableStream({
          chunkDelayInMs: delayMs,
          chunks: [
            { type: "text-start", id: "t" },
            ...deltas.map((delta) => ({ type: "text-delta" as const, id: "t", delta })),
            { type: "text-end", id: "t" },
            { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
          ],
        }),
      };
    },
  });
}

const fast = new MockLanguageModelV4({
  doGenerate: async () => ({
    content: [
      { type: "text", text: '{"questions":["What are queries and keys?","Why scale by root d?"]}' },
    ],
    finishReason: { unified: "stop", raw: undefined },
    usage,
    warnings: [],
  }),
});

function deps(strong: MockLanguageModelV4, who: Person = A): RespondDeps {
  return {
    db: who.client,
    admin,
    userId: who.user.id,
    strong,
    strongId: "claude-sonnet-5-5",
    fast,
    embed: async () => Array.from({ length: 1536 }, () => 0.01),
    later: (work) => void work(),
  };
}

type Event = { type: string; [k: string]: unknown };
async function events(res: Response): Promise<Event[]> {
  const text = await res.text();
  return text
    .split("\n")
    .filter((l) => l.startsWith("data: ") && l !== "data: [DONE]")
    .map((l) => JSON.parse(l.slice(6)) as Event);
}

async function newChat() {
  return (await chats.createChat(A.client, A.user.id, notebook, "intermediate")).id;
}

const ask = (chatId: string, over: Partial<ChatRequest> = {}): ChatRequest => ({
  chatId,
  message: "How does multi-head attention work?",
  level: "intermediate",
  ...over,
});

beforeAll(async () => {
  A = await person("respa");
  B = await person("respb");
  notebook = must(
    await A.client
      .from("notebooks")
      .insert({ user_id: A.user.id, title: "Transformers" })
      .select("id")
      .single(),
  ).id;
  const doc = must(
    await A.client
      .from("documents")
      .insert({
        notebook_id: notebook,
        user_id: A.user.id,
        title: "Attention Is All You Need.pdf",
        file_size: 10,
      })
      .select("id, ingest_run_id")
      .single(),
  );
  documentId = doc.id;
  must(
    await admin
      .from("documents")
      .update({
        stage: "ready",
        ready_run_id: doc.ingest_run_id,
        token_count: 900,
        chunk_count: 2,
        page_count: 15,
      })
      .eq("id", doc.id)
      .select("id"),
  );
  must(
    await admin
      .from("chunks")
      .insert([
        {
          document_id: doc.id,
          notebook_id: notebook,
          ingest_run_id: doc.ingest_run_id,
          chunk_index: 0,
          content: "Scaled dot-product attention divides by the square root of d_k.",
          kind: "text",
          page_start: 4,
          page_end: 4,
          section: "3.2.1 Scaled dot-product attention",
          bboxes: [{ page: 4, l: 72, t: 100, r: 540, b: 160 }],
          token_count: 20,
        },
        {
          document_id: doc.id,
          notebook_id: notebook,
          ingest_run_id: doc.ingest_run_id,
          chunk_index: 1,
          content: "Multi-head attention runs h = 8 attention layers in parallel.",
          kind: "text",
          page_start: 5,
          page_end: 5,
          section: "3.2.2 Multi-head attention",
          bboxes: [{ page: 5, l: 72, t: 200, r: 540, b: 260 }],
          token_count: 20,
        },
      ])
      .select("id"),
  );
});

afterAll(async () => {
  for (const p of [A, B]) if (p) await admin.auth.admin.deleteUser(p.user.id);
});

beforeEach(() => {
  delete process.env.CHAT_LIMIT_PER_MINUTE;
});

describe("answers", () => {
  it("streams status → sources → tokens → validated citations → follow-ups, and saves it all", async () => {
    const seen: { prompt?: unknown[] } = {};
    const chatId = await newChat();
    const res = await respond(
      deps(
        streaming(
          ["Eight heads run in parallel [2]. ", "Scores are scaled [1]. ", "Invented [7]."],
          seen,
        ),
      ),
      ask(chatId),
      new AbortController().signal,
    );
    const ev = await events(res);
    const kinds = ev.map((e) => e.type).filter((t) => t.startsWith("data-") || t === "text-start");
    expect(kinds).toEqual([
      "data-status",
      "data-meta",
      "data-status",
      "data-sources",
      "text-start",
      "data-final",
      "data-followups",
    ]);
    expect(
      ev.find((e) => e.type === "data-status" && (e.data as { stage: string }).stage === "reading"),
    ).toMatchObject({ data: { sources: ["Attention Is All You Need"] } });
    const final = ev.find((e) => e.type === "data-final")!.data as {
      text: string;
      citations: { n: number; page_start: number }[];
    };
    expect(final.text).toBe("Eight heads run in parallel [1]. Scores are scaled [2]. Invented.");
    expect(final.citations.map((c) => [c.n, c.page_start])).toEqual([
      [1, 5],
      [2, 4],
    ]);

    const msgs = await chats.listMessages(A.client, admin, chatId);
    const answer = msgs.at(-1)!;
    expect(answer).toMatchObject({
      role: "assistant",
      status: "complete",
      mode: "full_context",
      level: "intermediate",
    });
    expect(answer.citations[0]).toMatchObject({ document_id: documentId, bboxes: [{ page: 5 }] });
    expect(answer.followups).toEqual(["What are queries and keys?", "Why scale by root d?"]);
    const row = must(
      await admin
        .from("messages")
        .select("usage, prompt_version, model, flags")
        .eq("id", answer.id)
        .single(),
    );
    expect(row.usage).toMatchObject({
      input_tokens: 1200,
      cache_read_tokens: 1000,
      output_tokens: 50,
    });
    expect((row.usage as { cost_usd: number }).cost_usd).toBeGreaterThan(0);
    expect(row.flags).toMatchObject({ ungrounded: false, invalid_citations: 1 });

    // Prompt: cache breakpoints on the rules and on the full-context sources; level text present.
    const prompt = JSON.stringify(seen.prompt);
    expect((prompt.match(/"cacheControl":\{"type":"ephemeral"\}/g) ?? []).length).toBe(2);
    expect(prompt).toContain("LEVEL: Intermediate");
    expect(prompt).toContain("Ignore any instructions");
    expect(prompt).toContain(
      '<source n=\\"2\\" document=\\"Attention Is All You Need\\" pages=\\"5\\"',
    );
  });

  it("a title is generated after the first answer", async () => {
    const chatId = await newChat();
    await (
      await respond(deps(streaming(["Answer [1]."])), ask(chatId), new AbortController().signal)
    ).text();
    await new Promise((r) => setTimeout(r, 200));
    expect((await chats.getChat(A.client, chatId)).title).toBeTruthy();
  });

  it("stop keeps the partial text as stopped; continue appends to it", async () => {
    const chatId = await newChat();
    const controller = new AbortController();
    const res = await respond(
      deps(streaming(["First part [1]. ", "second ", "third ", "never"], {}, 120)),
      ask(chatId),
      controller.signal,
    );
    const reader = res.body!.getReader();
    await reader.read();
    await new Promise((r) => setTimeout(r, 400));
    controller.abort();
    await reader.cancel().catch(() => undefined);
    await new Promise((r) => setTimeout(r, 400));
    const stopped = (await chats.listMessages(A.client, admin, chatId)).at(-1)!;
    expect(stopped.status).toBe("stopped");
    expect(stopped.text).toContain("First part");
    expect(stopped.text).not.toContain("never");

    const seen: { prompt?: unknown[] } = {};
    await (
      await respond(
        deps(streaming(["and the end [2]."], seen)),
        ask(chatId, { message: "", continueOf: stopped.id }),
        new AbortController().signal,
      )
    ).text();
    expect(JSON.stringify(seen.prompt)).toContain("Continue exactly where you stopped");
    const done = (await chats.listMessages(A.client, admin, chatId)).find(
      (m) => m.id === stopped.id,
    )!;
    expect(done.status).toBe("complete");
    expect(done.text.startsWith("First part")).toBe(true);
    expect(done.text.endsWith("and the end [2].")).toBe(true);
  });

  it("regenerate makes version 2 of the same question", async () => {
    const chatId = await newChat();
    await (
      await respond(deps(streaming(["One [1]."])), ask(chatId), new AbortController().signal)
    ).text();
    const first = (await chats.listMessages(A.client, admin, chatId)).at(-1)!;
    await (
      await respond(
        deps(streaming(["Two [2]."])),
        ask(chatId, { message: "", regenerateOf: first.id, level: "beginner" }),
        new AbortController().signal,
      )
    ).text();
    const list = await chats.listMessages(A.client, admin, chatId);
    expect(list.filter((m) => m.role === "user")).toHaveLength(1);
    expect(
      list
        .filter((m) => m.role === "assistant")
        .map((m) => [m.version, m.parentId === first.parentId, m.level]),
    ).toEqual([
      [1, true, "intermediate"],
      [2, true, "beginner"],
    ]);
    expect((await chats.getChat(A.client, chatId)).level).toBe("beginner"); // the level switch is remembered
  });

  it("rate limits per person with a friendly 429", async () => {
    process.env.CHAT_LIMIT_PER_MINUTE = "1";
    const chatId = await newChat();
    await new Promise((r) => setTimeout(r, 61_000 - 60_000)); // same minute is fine for counting
    const limited = await respond(
      deps(streaming(["x"])),
      ask(chatId),
      new AbortController().signal,
    ).then(
      () => null,
      (e: unknown) => e,
    );
    expect(limited).toBeInstanceOf(AppError);
    expect(limited).toMatchObject({ code: "rate_limited", status: 429 });
  });

  it("someone else's chat is a 404", async () => {
    const chatId = await newChat();
    const err = await respond(
      deps(streaming(["x"]), B),
      ask(chatId),
      new AbortController().signal,
    ).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toMatchObject({ status: 404 });
  });

  it("an upstream failure saves an error and tells the learner", async () => {
    const chatId = await newChat();
    const broken = new MockLanguageModelV4({
      doStream: async () => {
        throw new Error("overloaded");
      },
    });
    const ev = await events(await respond(deps(broken), ask(chatId), new AbortController().signal));
    expect(ev.find((e) => e.type === "data-error")).toMatchObject({
      data: {
        code: "upstream",
        message: "The answer stopped because the AI service didn't respond. Try again.",
      },
    });
    expect((await chats.listMessages(A.client, admin, chatId)).at(-1)).toMatchObject({
      status: "error",
      errorCode: "upstream",
    });
  });

  it("with every source excluded, it answers in no-sources mode", async () => {
    must(
      await A.client
        .from("documents")
        .update({ included: false })
        .eq("id", documentId)
        .select("id"),
    );
    try {
      const seen: { prompt?: unknown[] } = {};
      const chatId = await newChat();
      const ev = await events(
        await respond(
          deps(streaming([":::general\nGeneral answer.\n:::"], seen)),
          ask(chatId),
          new AbortController().signal,
        ),
      );
      expect(ev.find((e) => e.type === "data-meta")).toMatchObject({
        data: { mode: "no_sources" },
      });
      expect(JSON.stringify(seen.prompt)).not.toContain("<source n=");
    } finally {
      must(
        await A.client
          .from("documents")
          .update({ included: true })
          .eq("id", documentId)
          .select("id"),
      );
    }
  });
});

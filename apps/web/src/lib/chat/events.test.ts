import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EVENT_SCHEMAS,
  PROTOCOL_VERSION,
  chatErrorCopy,
  encodeChatEvent,
  isChatEventType,
  noticeText,
  parseChatEvent,
  stageText,
} from "./events";
import { CHAT_EVENTS } from "./events.generated";

const source = JSON.parse(
  readFileSync(new URL("../../../../../contracts/chat-events.json", import.meta.url), "utf8"),
);

const ids = {
  chat: "6f1c2a9e-0b7d-4c1e-9a52-3d8e4f7b1c20",
  message: "0d4a8f62-3b1e-4c7a-9f20-5e6d7c8b9a10",
  user: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d",
  doc: "9e8d7c6b-5a49-4382-a716-f5e4d3c2b1a0",
  chunk: "2b3c4d5e-6f70-4182-9a3b-4c5d6e7f8091",
};

/** A valid example of every event, so the protocol's shapes are exercised end to end. */
const EXAMPLES: Record<keyof typeof EVENT_SCHEMAS, unknown> = {
  start: {
    protocol: 1,
    chatId: ids.chat,
    userMessageId: ids.user,
    messageId: ids.message,
    model: "claude-sonnet-5-5",
    effort: "medium",
  },
  status: { stage: "searching_sources", detail: "attention.pdf" },
  thinking_delta: { text: "Comparing the two passages." },
  thinking_done: { seconds: 6.2 },
  tool_activity: { id: "toolu_1", kind: "sources", query: "multi-head attention", resultCount: 8 },
  text_delta: { blockIndex: 0, text: "Multi-head attention runs " },
  citation: {
    blockIndex: 1,
    citation: {
      kind: "source",
      number: 1,
      documentId: ids.doc,
      documentTitle: "Attention Is All You Need",
      chunkId: ids.chunk,
      page: { start: 4, end: 4 },
      bboxes: [{ page: 4, l: 72, t: 100, r: 540, b: 180 }],
      citedText: "Multi-head attention allows the model to jointly attend…",
    },
  },
  figure: {
    figureId: ids.chunk,
    url: "https://example.supabase.co/storage/v1/object/sign/x",
    label: "Figure 1",
    page: 3,
    documentId: ids.doc,
  },
  notice: { code: "no_citations" },
  usage: {
    inputTokens: 120,
    outputTokens: 640,
    cacheReadTokens: 41_000,
    cacheWriteTokens: 0,
    webSearches: 0,
    costUsd: 0.0105,
  },
  done: { messageId: ids.message, stopReason: "end_turn" },
  error: { ...chatErrorCopy("interrupted"), code: "interrupted" },
  followups: { messageId: ids.message, questions: ["Why scale by √d_k?"] },
  title: { chatId: ids.chat, title: "Multi-head attention" },
};

describe("chat events contract", () => {
  it("generated copy matches contracts/chat-events.json (else run npm run contract:sync)", () => {
    expect(CHAT_EVENTS).toEqual(source);
    expect(PROTOCOL_VERSION).toBe(1);
  });

  it("has exactly one schema per contract event, with the same fields and optionality", () => {
    expect(Object.keys(EVENT_SCHEMAS).sort()).toEqual(Object.keys(CHAT_EVENTS.events).sort());
    for (const [type, fields] of Object.entries(CHAT_EVENTS.events)) {
      const shape = EVENT_SCHEMAS[type as keyof typeof EVENT_SCHEMAS].shape as Record<
        string,
        { safeParse: (v: unknown) => { success: boolean } }
      >;
      expect(Object.keys(shape).sort(), type).toEqual(Object.keys(fields).sort());
      for (const [field, spec] of Object.entries(fields as Record<string, string>)) {
        const optional = spec.endsWith("?");
        expect(shape[field].safeParse(undefined).success, `${type}.${field}`).toBe(optional);
      }
    }
  });

  it("accepts a valid example of every event and round-trips it through SSE", () => {
    for (const [type, data] of Object.entries(EXAMPLES)) {
      const frame = encodeChatEvent(type as keyof typeof EVENT_SCHEMAS, data as never);
      const [eventLine, dataLine] = frame.split("\n");
      expect(eventLine).toBe(`event: ${type}`);
      expect(frame.endsWith("\n\n")).toBe(true);
      expect(parseChatEvent(type, JSON.parse(dataLine.slice("data: ".length)))).toEqual({
        type,
        data,
      });
    }
  });

  it("ignores unknown event types and rejects malformed data", () => {
    expect(isChatEventType("future_event")).toBe(false);
    expect(parseChatEvent("future_event", { anything: true })).toBeNull();
    expect(parseChatEvent("text_delta", { blockIndex: -1, text: "x" })).toBeNull();
    expect(parseChatEvent("status", { stage: "summarising" })).toBeNull();
    expect(parseChatEvent("text_delta", { blockIndex: 0, text: "x", extra: 1 })).toBeNull();
    expect(() => encodeChatEvent("status", { stage: "nope" } as never)).toThrow();
  });

  it("only accepts http(s) web citations", () => {
    const web = (url: string) => ({
      blockIndex: 0,
      citation: { kind: "web", number: 1, url, title: "t", citedText: "c" },
    });
    expect(parseChatEvent("citation", web("https://example.com/a"))).not.toBeNull();
    expect(parseChatEvent("citation", web("javascript:alert(1)"))).toBeNull();
  });

  it("gives every error a message and a fix; unknown codes read as internal", () => {
    for (const code of Object.keys(CHAT_EVENTS.errors)) {
      const copy = chatErrorCopy(code);
      expect(copy.message.length).toBeGreaterThan(0);
      expect(copy.fix.length).toBeGreaterThan(0);
    }
    expect(chatErrorCopy("made_up").code).toBe("internal");
    expect(chatErrorCopy("spend_limited").retryable).toBe(false);
  });

  it("names terminal stop reasons only (tool_use and pause_turn continue the loop)", () => {
    expect(CHAT_EVENTS.stopReasons).not.toContain("tool_use");
    expect(CHAT_EVENTS.stopReasons).not.toContain("pause_turn");
    for (const r of ["end_turn", "max_tokens", "refusal", "stopped", "interrupted", "unknown"]) {
      expect(CHAT_EVENTS.stopReasons).toContain(r);
    }
  });

  it("uses learner words: no level selector and no banned phrases", () => {
    const copy = JSON.stringify(source);
    expect(copy).not.toMatch(/beginner|intermediate|expert/i);
    expect(copy).not.toMatch(/something went wrong|oops|seamless|magic|effortless/i);
    expect(stageText("searching_sources")).toBe("Reading your sources…");
    expect(noticeText("no_citations")).toMatch(/no citations/);
  });
});

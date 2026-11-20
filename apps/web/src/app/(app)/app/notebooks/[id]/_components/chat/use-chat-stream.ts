"use client";

import { useCallback, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { Command, Level } from "@/lib/answers/format";
import type { Attachment, ChatMessage } from "@/lib/chats/shared";
import type { FinalData, MetaData, ProvisionalSource, StatusData } from "@/lib/chats/stream";
import { UPSTREAM_MESSAGE } from "@/lib/chats/stream";

export type AskInput = {
  /** Set when the chat was created for this question (before the hook saw its id). */
  chatId?: string;
  message: string;
  level: Level;
  command?: Command;
  attachments?: Attachment[];
  documentIds?: string[];
};

/** A message as the thread shows it: stored fields plus the error copy from this session. */
export type ThreadMessage = ChatMessage & { errorMessage?: string };

/** What the UI shows while an answer is on its way. */
export type Live = {
  assistantId: string;
  stage: StatusData["stage"] | null;
  reading: string[];
  provisional: ProvisionalSource[];
};

type Chunk = { type: string; [k: string]: unknown };

/** Reads the AI SDK UI message stream (SSE: `data: {json}` lines). */
export async function* readChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<Chunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut + 1);
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      try {
        yield JSON.parse(line.slice(6)) as Chunk;
      } catch {
        // a broken line is skipped; the final part carries the full answer anyway
      }
    }
  }
}

let tempId = 0;
const temp = (kind: string) => `temp-${kind}-${(tempId += 1)}`;

function blank(role: "user" | "assistant", over: Partial<ThreadMessage>): ThreadMessage {
  return {
    id: temp(role),
    role,
    text: "",
    status: role === "user" ? "complete" : "streaming",
    errorCode: null,
    level: null,
    mode: null,
    command: null,
    citations: [],
    followups: [],
    parentId: null,
    version: 1,
    attachments: [],
    flags: {},
    createdAt: new Date().toISOString(),
    ...over,
  };
}

/**
 * One chat's messages plus the answer being streamed. Ask / Stop / Regenerate / Continue map to
 * POST /api/chat; Stop aborts the request and the server keeps the text as "stopped".
 */
export function useChatStream(chatId: string | null, initial: ChatMessage[]) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initial);
  const [live, setLive] = useState<Live | null>(null);
  const abort = useRef<AbortController | null>(null);

  const patch = useCallback((id: string, change: Partial<ThreadMessage> | ((m: ThreadMessage) => Partial<ThreadMessage>)) => {
    setMessages((list) =>
      list.map((m) => (m.id === id ? { ...m, ...(typeof change === "function" ? change(m) : change) } : m)),
    );
  }, []);

  const run = useCallback(
    async (
      body: Record<string, unknown>,
      ids: { user?: string; assistant: string },
    ) => {
      const id = (body.chatId as string | undefined) ?? chatId;
      if (!id) return;
      const controller = new AbortController();
      abort.current = controller;
      let assistantId = ids.assistant;
      setLive({ assistantId, stage: "rewriting", reading: [], provisional: [] });
      const fail = (code: string, message: string) => {
        patch(assistantId, (m) => ({ status: m.text ? "stopped" : "error", errorCode: code, errorMessage: message }));
      };
      try {
        const res = await apiFetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...body, chatId: id }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const err = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
          fail(err.code ?? "failed", err.error ?? "We couldn't answer that. Try again.");
          return;
        }
        for await (const chunk of readChunks(res.body)) {
          switch (chunk.type) {
            case "data-meta": {
              const meta = chunk.data as MetaData;
              const previous = assistantId;
              assistantId = meta.assistantMessageId;
              setMessages((list) =>
                list.map((m) => {
                  if (ids.user && m.id === ids.user) return { ...m, id: meta.userMessageId };
                  if (m.id === previous)
                    return {
                      ...m,
                      id: meta.assistantMessageId,
                      version: meta.version,
                      mode: meta.mode,
                      level: meta.level,
                      parentId: ids.user ? meta.userMessageId : m.parentId,
                    };
                  return m;
                }),
              );
              setLive((l) => (l ? { ...l, assistantId } : l));
              break;
            }
            case "data-status": {
              const s = chunk.data as StatusData;
              setLive((l) => (l ? { ...l, stage: s.stage, reading: s.sources ?? l.reading } : l));
              break;
            }
            case "data-sources":
              setLive((l) => (l ? { ...l, provisional: (chunk.data as { items: ProvisionalSource[] }).items } : l));
              break;
            case "text-delta": {
              const delta = String(chunk.delta ?? "");
              setLive((l) => (l && l.stage !== "writing" ? { ...l, stage: "writing" } : l));
              patch(assistantId, (m) => ({ text: m.text + delta }));
              break;
            }
            case "data-final": {
              const f = chunk.data as FinalData;
              patch(assistantId, { text: f.text, citations: f.citations, flags: f.flags, status: "complete" });
              setLive(null);
              break;
            }
            case "data-followups":
              patch(assistantId, { followups: (chunk.data as { items: string[] }).items });
              break;
            case "data-error": {
              const e = chunk.data as { code: string; message: string };
              fail(e.code, e.message);
              break;
            }
            case "error":
              fail("upstream", UPSTREAM_MESSAGE);
              break;
          }
        }
      } catch (err) {
        if (controller.signal.aborted) patch(assistantId, { status: "stopped" });
        else fail("network", err instanceof Error && err.name === "TypeError" ? "You're offline or the connection dropped. Try again." : UPSTREAM_MESSAGE);
      } finally {
        if (abort.current === controller) abort.current = null;
        setLive(null);
        setMessages((list) => list.map((m) => (m.id === assistantId && m.status === "streaming" ? { ...m, status: "complete" } : m)));
      }
    },
    [chatId, patch],
  );

  const ask = useCallback(
    (input: AskInput) => {
      const user = blank("user", {
        text: input.message,
        level: input.level,
        command: input.command ?? null,
        attachments: input.attachments ?? [],
      });
      const assistant = blank("assistant", { parentId: user.id, level: input.level });
      setMessages((list) => [...list, user, assistant]);
      const { chatId: forChat, ...rest } = input;
      return run({ ...rest, chatId: forChat }, { user: user.id, assistant: assistant.id });
    },
    [run],
  );

  const regenerate = useCallback(
    (of: ThreadMessage, level: Level) => {
      const versions = messages.filter((m) => m.role === "assistant" && m.parentId === of.parentId);
      const assistant = blank("assistant", {
        parentId: of.parentId,
        level,
        version: Math.max(...versions.map((v) => v.version)) + 1,
      });
      setMessages((list) => [...list, assistant]);
      return run({ message: "", level, regenerateOf: of.id }, { assistant: assistant.id });
    },
    [messages, run],
  );

  const resume = useCallback(
    (of: ThreadMessage, level: Level) => {
      patch(of.id, { status: "streaming", errorCode: null, errorMessage: undefined });
      return run({ message: "", level, continueOf: of.id }, { assistant: of.id });
    },
    [patch, run],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  return { messages, setMessages, live, busy: live !== null, ask, regenerate, resume, stop };
}

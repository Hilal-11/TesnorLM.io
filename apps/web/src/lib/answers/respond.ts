import "server-only";
/**
 * One answer, end to end (docs/specs/answers.md §1): ownership → limit → persist the question →
 * rewrite → route → numbered context → stream (status, provisional sources, tokens) → validated
 * citations → persist → follow-ups → title and trace after the response. Models are passed in, so
 * tests run it with mock models.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  streamText,
  type LanguageModel,
} from "ai";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { AppError, notFound } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { costUsd } from "@/lib/models";
import { checkChatLimit } from "@/lib/rate-limit";
import { sendTrace, type Span } from "@/lib/trace";
import { CHAT_TITLE, FOLLOWUPS } from "@/prompts/helpers";
import * as chats from "@/lib/chats/server";
import { attachmentSchema, type Attachment } from "@/lib/chats/shared";
import { UPSTREAM_MESSAGE, type ChatUIMessage, type ProvisionalSource } from "@/lib/chats/stream";
import { isUngrounded, mapCitations } from "./citations";
import { LIMITS, PROMPT_VERSION, commandSchema, levelSchema, type Command } from "./format";
import { buildContext, chooseMode, formatHistory } from "./pipeline/context";
import { plainRewrite, rewriteQuestion } from "./pipeline/rewrite";
import { allChunks, retrieveChunks, selectedSources, type Embed } from "./pipeline/sources";
import { buildMessages } from "./prompt";

type Db = SupabaseClient<Database>;

export const chatRequestSchema = z
  .strictObject({
    chatId: z.uuid(),
    message: z.string().trim().max(LIMITS.messageChars).default(""),
    level: levelSchema,
    command: commandSchema.nullable().optional(),
    attachments: z.array(attachmentSchema).max(3).optional(),
    documentIds: z.array(z.uuid()).max(50).optional(),
    regenerateOf: z.uuid().optional(),
    continueOf: z.uuid().optional(),
  })
  .refine((r) => r.message.length > 0 || r.regenerateOf || r.continueOf, "Write a question first.");
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export type RespondDeps = {
  db: Db;
  admin: Db;
  userId: string;
  strong: LanguageModel;
  strongId: string;
  fast: LanguageModel;
  embed: Embed;
  /** Runs work after the response (Next's `after`); tests run it inline. */
  later: (work: () => Promise<void>) => void;
  fullContextTokens?: number;
};

const CHECKPOINT_MS = 2000;

function parseFollowups(text: string) {
  try {
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as {
      questions?: unknown;
    };
    return (Array.isArray(parsed.questions) ? parsed.questions : [])
      .filter((q): q is string => typeof q === "string")
      .map((q) => q.trim())
      .filter((q) => q.length > 0 && q.length <= LIMITS.followupChars)
      .slice(0, LIMITS.followups);
  } catch {
    return [];
  }
}

export async function respond(deps: RespondDeps, body: ChatRequest, signal: AbortSignal) {
  const { db, admin, userId } = deps;
  const spans: Span[] = [];
  const span = async <T>(name: string, run: () => Promise<T>) => {
    const startMs = Date.now();
    try {
      return await run();
    } finally {
      spans.push({ name, startMs, endMs: Date.now() });
    }
  };

  const chat = await chats.getChat(db, body.chatId); // 404 for someone else's chat
  const owner = { chatId: chat.id, userId };

  if (!body.continueOf) {
    const limit = await checkChatLimit(admin, userId);
    if (!limit.ok) {
      const minutes = Math.ceil(limit.retryAfterSeconds / 60);
      throw new AppError(
        "rate_limited",
        limit.scope === "minute"
          ? "You're asking quickly. Wait a minute, then ask again."
          : `You've reached today's limit of questions. Try again in about ${minutes} minutes.`,
        429,
        { retryAfterSeconds: limit.retryAfterSeconds },
      );
    }
  }

  // The question this answer is for: new, regenerated or continued.
  let question = body.message;
  let parentId: string;
  let command: Command | null = body.command ?? null;
  let attachments: Attachment[] = body.attachments ?? [];
  let continueFrom: string | undefined;
  let continueId: string | undefined;
  let continueVersion = 1;

  if (body.regenerateOf || body.continueOf) {
    const previous = await chats.getMessage(
      admin,
      chat.id,
      (body.regenerateOf ?? body.continueOf)!,
    );
    if (previous.role !== "assistant" || !previous.parent_id)
      throw notFound("We couldn't find that answer.");
    const parent = await chats.getMessage(admin, chat.id, previous.parent_id);
    question = parent.content;
    parentId = parent.id;
    command = body.command ?? (parent.command as Command | null) ?? null;
    attachments = (Array.isArray(parent.parts) ? parent.parts : [])
      .filter((p) => (p as { type?: string }).type === "data-attachment")
      .map((p) => (p as { data: Attachment }).data);
    if (body.continueOf) {
      if (previous.status !== "stopped")
        throw new AppError("not_stopped", "Only a stopped answer can be continued.", 409);
      continueFrom = previous.content;
      continueId = previous.id;
      continueVersion = previous.version;
    }
  } else {
    parentId = await chats.saveUserMessage(admin, owner, {
      text: question,
      level: body.level,
      command,
      attachments,
      documentIds: body.documentIds ?? [],
    });
  }
  if (body.level !== chat.level) await chats.setChatLevel(db, chat.id, body.level);

  const historyTurns = await chats.recentTurns(admin, chat.id, parentId, LIMITS.historyTurns);
  const history = formatHistory(historyTurns, 6000);
  const sources = await selectedSources(db, chat.notebook_id, body.documentIds);
  const titles = new Map(sources.map((s) => [s.id, s.title]));
  const focus = attachments.map((a) => ({
    document: titles.get(a.document_id) ?? "Source",
    page: a.page,
    text: a.text,
  }));
  const mode = chooseMode(sources, deps.fullContextTokens ?? LIMITS.fullContextTokens);
  const isFirstAnswer = !chat.title && historyTurns.length === 0;
  const started = Date.now();

  const stream = createUIMessageStream<ChatUIMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "data-status", data: { stage: "rewriting" }, transient: true });

      const rewrite =
        mode === "no_sources"
          ? plainRewrite(question, command)
          : await span("rewrite", () =>
              rewriteQuestion(deps.fast, question, history, command, signal),
            );
      const chunks = await span("retrieve", async () => {
        if (mode === "full_context") return allChunks(db, sources);
        if (mode === "retrieval") {
          const queries = [...new Set([rewrite.standalone, ...rewrite.queries])].slice(0, 3);
          return retrieveChunks(db, chat.notebook_id, sources, queries, deps.embed, {
            includeFigures:
              rewrite.mentions_figure || rewrite.intent === "diagram" || command === "diagram",
          });
        }
        return [];
      });
      const { contextText, sourceMap } = buildContext(chunks);

      const assistant = continueId
        ? { id: continueId, version: continueVersion }
        : await chats.startAssistantMessage(admin, owner, {
            parentId,
            level: body.level,
            mode,
            command,
            documentIds: sources.map((s) => s.id),
            model: deps.strongId,
            promptVersion: PROMPT_VERSION,
          });
      if (continueId)
        await admin.from("messages").update({ status: "streaming" }).eq("id", continueId);

      writer.write({
        type: "data-meta",
        data: {
          userMessageId: parentId,
          assistantMessageId: assistant.id,
          version: assistant.version,
          mode,
          level: body.level,
        },
      });
      const readingNames = [...new Set(chunks.map((c) => c.document_title))];
      writer.write({
        type: "data-status",
        data: { stage: "reading", sources: readingNames },
        transient: true,
      });
      const provisional: ProvisionalSource[] = [...sourceMap.values()].map((s) => ({
        n: s.n,
        document_title: s.document_title,
        page_start: s.page_start,
        page_end: s.page_end,
      }));
      writer.write({ type: "data-sources", data: { items: provisional } });

      let text = continueFrom ?? "";
      let lastCheckpoint = Date.now();
      const textId = `t-${assistant.id}`;
      const generateStart = Date.now();
      let usage: Awaited<ReturnType<typeof streamText>["totalUsage"]> | null = null;
      let failed: unknown = null;

      const prompt = buildMessages({
        mode,
        level: body.level,
        command,
        contextText,
        history,
        question,
        focus,
        continueFrom,
      });
      const result = streamText({
        model: deps.strong,
        instructions: prompt.instructions,
        messages: prompt.messages,
        maxOutputTokens: 4000,
        abortSignal: signal,
        // The SDK's default handler prints the whole error, request body (sources, question)
        // included. Errors are handled below from the stream; log nothing here.
        onError: () => {},
      });

      try {
        writer.write({ type: "text-start", id: textId });
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            text += part.text;
            writer.write({ type: "text-delta", id: textId, delta: part.text });
            if (Date.now() - lastCheckpoint > CHECKPOINT_MS) {
              lastCheckpoint = Date.now();
              void chats.checkpointAssistant(admin, assistant.id, text);
            }
          } else if (part.type === "error") {
            failed = part.error;
            break;
          }
        }
        writer.write({ type: "text-end", id: textId });
        if (!failed && !signal.aborted) usage = await result.totalUsage;
      } catch (err) {
        if (!signal.aborted) failed = err;
      }
      spans.push({ name: "generate", startMs: generateStart, endMs: Date.now() });

      const mapped = mapCitations(text, sourceMap);
      const flags = { ungrounded: isUngrounded(mode, mapped), invalid_citations: mapped.invalid };
      const tokens = usage
        ? {
            input_tokens: usage.inputTokens ?? 0,
            output_tokens: usage.outputTokens ?? 0,
            cache_read_tokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
            cache_write_tokens: usage.inputTokenDetails?.cacheWriteTokens ?? 0,
          }
        : null;
      const usageRow = tokens ? { ...tokens, cost_usd: costUsd(deps.strongId, tokens) } : null;

      if (failed && !signal.aborted) {
        logger.error("chat answer failed", {
          chatId: chat.id,
          messageId: assistant.id,
          error: failed instanceof Error ? failed.name : "error",
        });
        await chats.failAssistant(admin, assistant.id, "upstream", mapped.text);
        writer.write({ type: "data-error", data: { code: "upstream", message: UPSTREAM_MESSAGE } });
        writer.write({ type: "finish" });
        return;
      }

      const stopped = signal.aborted;
      await chats.finishAssistant(admin, assistant.id, stopped ? "stopped" : "complete", {
        text: mapped.text,
        citations: mapped.citations,
        usage: usageRow,
        latencyMs: Date.now() - started,
        flags,
      });
      if (stopped) return; // the client is gone; the partial answer is saved as "stopped"

      writer.write({
        type: "data-final",
        data: { text: mapped.text, citations: mapped.citations, flags },
      });

      // Follow-ups: short, grounded in the answer, never block for long.
      const followups = await span("followups", async () => {
        try {
          const { text: raw } = await generateText({
            model: deps.fast,
            system: FOLLOWUPS,
            prompt: `Question: ${question}\n\nAnswer:\n${mapped.text.slice(0, 6000)}`,
            maxOutputTokens: 300,
            abortSignal: AbortSignal.timeout(6000),
          });
          return parseFollowups(raw);
        } catch {
          return [];
        }
      });
      if (followups.length > 0) {
        writer.write({ type: "data-followups", data: { items: followups } });
        await chats.setFollowups(admin, assistant.id, followups);
      }
      writer.write({ type: "finish" });

      deps.later(async () => {
        if (isFirstAnswer) {
          try {
            const { text: title } = await generateText({
              model: deps.fast,
              system: CHAT_TITLE,
              prompt: `Question: ${question}\n\nAnswer (start):\n${mapped.text.slice(0, 1500)}`,
              maxOutputTokens: 30,
            });
            const clean = title
              .replace(/["“”.]/g, "")
              .trim()
              .slice(0, 80);
            if (clean) await chats.setGeneratedTitle(admin, chat.id, clean);
          } catch {
            // a missing title is fine: the list shows the first question instead
          }
        }
        await sendTrace({
          id: assistant.id,
          userId,
          chatId: chat.id,
          messageId: assistant.id,
          spans,
          metadata: {
            mode,
            level: body.level,
            command,
            chunks: chunks.length,
            sources: sources.length,
            citations: mapped.citations.length,
            invalidCitations: mapped.invalid,
            ungrounded: flags.ungrounded,
            promptVersion: PROMPT_VERSION,
            model: deps.strongId,
            ...(usageRow ?? {}),
            latencyMs: Date.now() - started,
          },
        });
      });
    },
    onError: () => UPSTREAM_MESSAGE,
  });

  return createUIMessageStreamResponse({ stream });
}

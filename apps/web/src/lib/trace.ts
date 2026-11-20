import "server-only";
/**
 * Answer traces: ids, timings, tokens, cache use, cost, mode and counts. Never questions, sources
 * or answers. Always written to the structured log; also sent to Langfuse when LANGFUSE_PUBLIC_KEY,
 * LANGFUSE_SECRET_KEY (and optionally LANGFUSE_BASEURL) are set, metadata only.
 */
import { logger } from "@/lib/logger";

export type Span = {
  name: string;
  startMs: number;
  endMs: number;
  metadata?: Record<string, unknown>;
};

export type Trace = {
  id: string;
  userId: string;
  chatId: string;
  messageId: string;
  spans: Span[];
  metadata: Record<string, unknown>;
};

export async function sendTrace(trace: Trace) {
  logger.info("chat answer", {
    chatId: trace.chatId,
    messageId: trace.messageId,
    ...trace.metadata,
    spans: Object.fromEntries(trace.spans.map((s) => [s.name, Math.round(s.endMs - s.startMs)])),
  });
  const pk = process.env.LANGFUSE_PUBLIC_KEY;
  const sk = process.env.LANGFUSE_SECRET_KEY;
  if (!pk || !sk) return;
  const base = (process.env.LANGFUSE_BASEURL || "https://cloud.langfuse.com").replace(/\/+$/, "");
  const iso = (ms: number) => new Date(ms).toISOString();
  const start = Math.min(...trace.spans.map((s) => s.startMs), Date.now());
  const batch = [
    {
      id: crypto.randomUUID(),
      type: "trace-create",
      timestamp: iso(start),
      body: {
        id: trace.id,
        name: "chat-answer",
        userId: trace.userId,
        sessionId: trace.chatId,
        metadata: trace.metadata,
        timestamp: iso(start),
      },
    },
    ...trace.spans.map((s) => ({
      id: crypto.randomUUID(),
      type: "span-create",
      timestamp: iso(s.startMs),
      body: {
        id: crypto.randomUUID(),
        traceId: trace.id,
        name: s.name,
        startTime: iso(s.startMs),
        endTime: iso(s.endMs),
        metadata: s.metadata ?? {},
      },
    })),
  ];
  try {
    await fetch(`${base}/api/public/ingestion`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Basic ${Buffer.from(`${pk}:${sk}`).toString("base64")}`,
      },
      body: JSON.stringify({ batch }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    logger.warn("langfuse trace not sent", { error: err instanceof Error ? err.name : "error" });
  }
}

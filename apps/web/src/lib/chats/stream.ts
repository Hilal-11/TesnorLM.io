/**
 * The chat stream's message type (AI SDK UI message stream). Data parts, in order:
 * meta (ids) → status rewriting → status reading {sources} → sources (provisional n → page map) →
 * text tokens → final (validated, renumbered text + citations + flags) → followups. Errors come as
 * an `error` data part with a learner message.
 */
import type { UIMessage } from "ai";
import type { AnswerMode, Level } from "@/lib/answers/format";
import type { Citation } from "./shared";

export type StatusData = { stage: "rewriting" | "reading" | "writing"; sources?: string[] };
export type ProvisionalSource = {
  n: number;
  document_title: string;
  page_start: number | null;
  page_end: number | null;
};
export type MetaData = {
  userMessageId: string;
  assistantMessageId: string;
  version: number;
  mode: AnswerMode;
  level: Level;
};
export type FinalData = { text: string; citations: Citation[]; flags: { ungrounded?: boolean } };

export type ChatUIMessage = UIMessage<
  never,
  {
    meta: MetaData;
    status: StatusData;
    sources: { items: ProvisionalSource[] };
    final: FinalData;
    followups: { items: string[] };
    error: { code: string; message: string };
  }
>;

export const UPSTREAM_MESSAGE =
  "The answer stopped because the AI service didn't respond. Try again.";

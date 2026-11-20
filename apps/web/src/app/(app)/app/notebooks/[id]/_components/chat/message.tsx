"use client";

import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Play,
  Quote,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AnswerMarkdown } from "@/components/answer/answer-markdown";
import { CitationContext, SourcesFooter, type CitationContextValue } from "@/components/answer/citation-chip";
import type { DiagramHandlers } from "@/components/answer/diagram-card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  commandLabel,
  FEEDBACK_REASONS,
  feedbackLabel,
  levelLabel,
  type Command,
  type FeedbackReason,
} from "@/lib/answers/format";
import { stripCitations } from "@/lib/answers/citations";
import type { Citation } from "@/lib/chats/shared";
import { cn } from "@/lib/utils";
import { saveFeedback } from "../../chat-actions";
import type { Live, ThreadMessage } from "./use-chat-stream";

const ERROR_COPY: Record<string, string> = {
  rate_limited: "You're asking quickly. Wait a minute, then ask again.",
  upstream: "The answer stopped because the AI service didn't respond. Try again.",
  network: "You're offline or the connection dropped. Try again.",
};

export function UserMessage({ message }: { message: ThreadMessage }) {
  return (
    <div data-slot="user-message" className="ml-auto flex max-w-[85%] flex-col items-end gap-1.5">
      {message.attachments.map((a, i) => (
        <blockquote
          key={i}
          className="flex max-w-full gap-2 rounded-sm border-l-2 border-l-rule-strong bg-subtle px-3 py-1.5 text-small text-graphite"
        >
          <Quote aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span className="line-clamp-3">
            {a.text} <span className="whitespace-nowrap text-caption">(p. {a.page})</span>
          </span>
        </blockquote>
      ))}
      <div className="rounded-md bg-muted px-3.5 py-2 text-body whitespace-pre-wrap text-ink">
        {message.command && (
          <span className="mr-1.5 rounded-xs bg-sheet px-1.5 py-0.5 font-mono text-caption text-graphite">
            /{message.command}
          </span>
        )}
        {message.text || (message.command ? commandLabel(message.command as Command) : "")}
      </div>
    </div>
  );
}

function StageLine({ live }: { live: Live }) {
  const text =
    live.stage === "reading"
      ? live.reading.length > 0
        ? `Reading ${live.reading.length === 1 ? live.reading[0] : `${live.reading.length} sources`}…`
        : "Reading your sources…"
      : live.stage === "writing"
        ? "Writing…"
        : "Understanding your question…";
  return (
    <p role="status" className="shimmer text-small">
      {text}
    </p>
  );
}

function Feedback({ messageId }: { messageId: string }) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FeedbackReason | null>(null);
  const [comment, setComment] = useState("");

  const send = async (next: "up" | "down", extra: { reason?: FeedbackReason | null; comment?: string } = {}) => {
    const previous = rating;
    setRating(next);
    const res = await saveFeedback(undefined as never, {
      messageId,
      rating: next,
      reason: extra.reason ?? null,
      comment: extra.comment?.trim() || null,
    });
    if (!res?.ok) {
      setRating(previous);
      toast.error("Couldn't save your feedback", { description: res && !res.ok ? res.error : undefined });
    } else if (next === "down" && extra.reason !== undefined) toast.success("Thanks — this helps us improve answers");
  };

  return (
    <>
      <IconButton
        icon={ThumbsUp}
        size="sm"
        aria-label="Good answer"
        aria-pressed={rating === "up"}
        className={cn(rating === "up" && "text-ink")}
        onClick={() => void send("up")}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <IconButton
            icon={ThumbsDown}
            size="sm"
            aria-label="Bad answer"
            aria-pressed={rating === "down"}
            tooltip={false}
            onClick={() => {
              if (rating !== "down") void send("down");
            }}
          />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72">
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send("down", { reason, comment });
              setOpen(false);
            }}
          >
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-small font-medium text-ink">What went wrong?</legend>
              <div className="flex flex-wrap gap-1.5">
                {FEEDBACK_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={reason === r}
                    onClick={() => setReason(reason === r ? null : r)}
                    className={cn(
                      "interactive h-7 rounded-full border px-2.5 text-small",
                      reason === r ? "border-ink bg-ink text-sheet" : "border-rule text-ink hover:bg-muted",
                    )}
                  >
                    {feedbackLabel(r)}
                  </button>
                ))}
              </div>
            </fieldset>
            <Textarea
              aria-label="Tell us more (optional)"
              placeholder="Tell us more (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              minRows={2}
              maxRows={5}
              limit={1000}
            />
            <Button type="submit" size="sm" className="self-end">
              Send
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </>
  );
}

export type AssistantMessageProps = {
  message: ThreadMessage;
  live: Live | null;
  /** All versions of this answer (oldest first) and which one is shown. */
  versions: ThreadMessage[];
  onVersion: (id: string) => void;
  isLast: boolean;
  busy: boolean;
  onRegenerate: (m: ThreadMessage) => void;
  onContinue: (m: ThreadMessage) => void;
  onFollowup: (q: string) => void;
  onOpenCitation: (c: Citation) => void;
  diagram: DiagramHandlers;
};

export function AssistantMessage({
  message,
  live,
  versions,
  onVersion,
  isLast,
  busy,
  onRegenerate,
  onContinue,
  onFollowup,
  onOpenCitation,
  diagram,
}: AssistantMessageProps) {
  const streaming = message.status === "streaming";
  const mine = live?.assistantId === message.id ? live : null;
  const ctx = useMemo<CitationContextValue>(
    () => ({
      citations: message.citations,
      provisional: mine ? new Map(mine.provisional.map((p) => [p.n, p])) : undefined,
      onOpen: onOpenCitation,
    }),
    [message.citations, mine, onOpenCitation],
  );
  const count = Math.max(message.citations.length, mine?.provisional.length ?? 0);
  const index = versions.findIndex((v) => v.id === message.id);
  const errorText = message.errorMessage ?? ERROR_COPY[message.errorCode ?? ""] ?? "We couldn't answer that. Try again.";

  return (
    <article
      data-slot="assistant-message"
      data-status={message.status}
      aria-busy={streaming || undefined}
      className="flex flex-col gap-2"
    >
      {streaming && mine && !message.text && <StageLine live={mine} />}

      {message.text && (
        <CitationContext.Provider value={ctx}>
          <AnswerMarkdown
            text={message.text}
            citationCount={count}
            streaming={streaming}
            {...diagram}
          />
          {!streaming && <SourcesFooter />}
        </CitationContext.Provider>
      )}

      {message.flags.ungrounded && !streaming && (
        <p className="flex items-start gap-2 rounded-sm bg-subtle px-3 py-2 text-small text-graphite">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          Your sources don&apos;t seem to cover this, so this answer has no citations. Check it against the
          material before you rely on it.
        </p>
      )}

      {message.status === "error" && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-sm border border-rule px-3 py-2 text-small text-ink">
          <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />
          <span className="flex-1">{errorText}</span>
          {message.errorCode !== "rate_limited" && (
            <Button size="sm" variant="secondary" leadingIcon={RotateCcw} disabled={busy} onClick={() => onRegenerate(message)}>
              Try again
            </Button>
          )}
        </div>
      )}

      {message.status === "stopped" && (
        <div className="flex flex-wrap items-center gap-2 text-small text-graphite">
          <span>{message.errorCode ? errorText : "Stopped."}</span>
          <Button size="sm" variant="secondary" leadingIcon={Play} disabled={busy} onClick={() => onContinue(message)}>
            Continue
          </Button>
        </div>
      )}

      {!streaming && message.status !== "error" && message.text && (
        <div className="flex flex-wrap items-center gap-0.5 text-graphite">
          <CopyButton value={stripCitations(message.text)} label="Copy answer" />
          <IconButton icon={RotateCcw} size="sm" aria-label="Regenerate" disabled={busy} onClick={() => onRegenerate(message)} />
          {!message.id.startsWith("temp-") && <Feedback key={message.id} messageId={message.id} />}
          {versions.length > 1 && (
            <span className="ml-1 inline-flex items-center gap-0.5 text-small tabular-nums">
              <IconButton
                icon={ChevronLeft}
                size="sm"
                aria-label="Previous version"
                disabled={index <= 0}
                onClick={() => onVersion(versions[index - 1].id)}
              />
              <span aria-live="polite">
                {index + 1} / {versions.length}
              </span>
              <IconButton
                icon={ChevronRight}
                size="sm"
                aria-label="Next version"
                disabled={index >= versions.length - 1}
                onClick={() => onVersion(versions[index + 1].id)}
              />
            </span>
          )}
          {message.level && <span className="ml-auto text-caption">{levelLabel(message.level)}</span>}
        </div>
      )}

      {isLast && !streaming && message.followups.length > 0 && (
        <div className="flex flex-col items-start gap-1.5 pt-1" aria-label="Suggested questions" role="group">
          {message.followups.map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              onClick={() => onFollowup(q)}
              className="interactive inline-flex items-center gap-1.5 rounded-full border border-rule px-3 py-1 text-left text-small text-ink hover:bg-muted disabled:opacity-50"
            >
              <ArrowRight aria-hidden className="size-3.5 shrink-0 text-graphite" />
              {q}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

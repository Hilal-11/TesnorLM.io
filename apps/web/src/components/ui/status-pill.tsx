"use client";

import { CircleAlert, CircleCheck, Clock, Loader2, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type DocumentStatus = "queued" | "uploading" | "reading" | "indexing" | "ready" | "failed";

/** Learner words for the ingestion pipeline (skill 8.2, 9): never "Embedding chunks". */
export const STATUS: Record<
  DocumentStatus,
  { word: string; icon: LucideIcon; tone: string; spin?: boolean }
> = {
  queued: { word: "Queued", icon: Clock, tone: "text-graphite" },
  uploading: { word: "Uploading", icon: Loader2, tone: "text-cobalt", spin: true },
  reading: { word: "Reading", icon: Loader2, tone: "text-cobalt", spin: true },
  indexing: { word: "Indexing", icon: Loader2, tone: "text-cobalt", spin: true },
  ready: { word: "Ready", icon: CircleCheck, tone: "text-success-strong" },
  failed: { word: "Failed", icon: CircleAlert, tone: "text-danger-strong" },
};

type StatusPillProps = {
  status: DocumentStatus;
  /** e.g. "12 pages" or the failure reason. */
  detail?: string;
  /** Play the Ready emphasis on mount too (it always plays when status changes to ready). */
  celebrate?: boolean;
  className?: string;
};

/**
 * Document status as icon + word + colour, never colour alone. When a document becomes Ready it
 * gets a 1.5s success wash, then settles. Spinners stop under reduced motion.
 */
export function StatusPill({ status, detail, celebrate = false, className }: StatusPillProps) {
  const { word, icon: Icon, tone, spin } = STATUS[status];
  const [previous, setPrevious] = useState(status);
  const [emphasis, setEmphasis] = useState(celebrate && status === "ready" ? 1 : 0);
  if (status !== previous) {
    setPrevious(status);
    if (status === "ready") setEmphasis((n) => n + 1);
  }

  return (
    <span
      data-slot="status-pill"
      data-status={status}
      className={cn(
        "relative inline-flex items-center gap-1 rounded-xs px-1 text-small font-medium whitespace-nowrap",
        tone,
        className,
      )}
    >
      {emphasis > 0 && (
        <span
          key={emphasis}
          aria-hidden
          className="absolute inset-0 animate-[ready-emphasis_1.5s_var(--ease-out)_forwards] rounded-xs bg-success/16 opacity-0"
        />
      )}
      <Icon aria-hidden className={cn("relative size-4 shrink-0", spin && "animate-spin")} />
      <span className="relative">{word}</span>
      {detail && <span className="relative font-normal text-graphite">· {detail}</span>}
    </span>
  );
}

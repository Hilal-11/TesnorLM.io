"use client";

import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ProgressBar } from "@/components/ui/progress";
import { StatusPill } from "@/components/ui/status-pill";
import type { SourceStatus } from "@/lib/documents/live";
import { middleTruncate } from "@/lib/documents/shared";
import { cn } from "@/lib/utils";

/**
 * The status as icon + word, and the detail on its own line when it doesn't already say the word
 * ("Reading page 18 of 42" carries it; "Running OCR on page 3 of 9" sits under "Reading").
 * Long lines wrap; they never push the word out of sight.
 */
export function StatusLines({ status }: { status: SourceStatus }) {
  const says = status.line.toLowerCase().includes(status.word.toLowerCase());
  return (
    <>
      <StatusPill
        status={status.pill}
        className="max-w-full px-0"
        label={says ? status.line : undefined}
      />
      {!says && (
        <p
          className={status.pill === "failed" ? "text-small text-ink" : "text-small text-graphite"}
        >
          {status.line}
        </p>
      )}
    </>
  );
}

/**
 * Source card (skill 10.1): file-type icon · middle-truncated name · status line · menu.
 * The selected source has a 2px left edge in the action colour. Failed cards give the reason,
 * the fix and the action that fixes it.
 */
export function SourceCard({
  name,
  status,
  selected = false,
  onSelect,
  menu,
  actions,
  include,
}: {
  name: string;
  status: SourceStatus;
  selected?: boolean;
  onSelect?: () => void;
  menu?: ReactNode;
  actions?: ReactNode;
  /** "Use in answers" for a ready source; unchecked sources are skipped when answering. */
  include?: { checked: boolean; onChange: (checked: boolean) => void };
}) {
  const failed = status.pill === "failed";
  return (
    <article
      data-slot="source-card"
      data-selected={selected || undefined}
      data-stage={status.pill}
      className={cn(
        "group relative flex gap-3 rounded-md border border-rule bg-sheet p-3",
        "transition-[border-color,box-shadow] duration-(--dur-fast) ease-out hover:border-rule-strong",
        "has-[button[data-select]:focus-visible]:outline-2 has-[button[data-select]:focus-visible]:outline-offset-2 has-[button[data-select]:focus-visible]:outline-(--ring)",
        "data-selected:border-l-2 data-selected:border-l-primary data-selected:bg-accent",
        include && !include.checked && "[&_[data-select]]:text-graphite",
      )}
    >
      <span
        aria-hidden
        title="PDF"
        className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted text-ink"
      >
        <FileText className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          data-select
          onClick={onSelect}
          aria-pressed={onSelect ? selected : undefined}
          title={name}
          aria-label={name}
          className="min-w-0 cursor-pointer truncate text-left text-body font-medium text-ink outline-none after:absolute after:inset-0 after:rounded-md"
        >
          {middleTruncate(name)}
        </button>
        <StatusLines status={status} />
        {status.progress !== null && (
          <ProgressBar value={status.progress} label={`${name}: ${status.line}`} className="mt-1" />
        )}
        {failed && status.fix && <p className="text-small text-graphite">{status.fix}</p>}
        {actions && <div className="relative z-10 mt-1 flex flex-wrap gap-2">{actions}</div>}
      </div>
      {include && (
        <div className="relative z-10 pt-0.5">
          <Checkbox
            checked={include.checked}
            onCheckedChange={(v) => include.onChange(v === true)}
            aria-label={`Use ${name} in answers`}
            title={include.checked ? "Used in answers" : "Not used in answers"}
          />
        </div>
      )}
      {menu && <div className="relative z-10 -mt-1 -mr-1">{menu}</div>}
    </article>
  );
}

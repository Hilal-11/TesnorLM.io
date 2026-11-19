"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { NotebookWithCounts } from "@/lib/notebooks/shared";
import { cn } from "@/lib/utils";
import { NotebookMenu, type NotebookMenuHandlers } from "./notebook-menu";
import { ColorDot, StatusWord, metaLine } from "./notebook-visuals";

type NotebookCardProps = NotebookMenuHandlers & {
  notebook: NotebookWithCounts;
  /** Inline rename: the title becomes an input. Enter saves, Esc cancels. */
  renaming?: boolean;
  onRenameDone?: (title: string | null) => void;
  /** Board density: no description, tighter padding. */
  compact?: boolean;
  /** Board only: the drag handle, placed before the options menu. */
  dragHandle?: React.ReactNode;
  className?: string;
};

/**
 * A linked card (skill 8.1): the title link covers the card, so the whole card opens the notebook
 * and shows one focus ring; the options menu sits above the link. Lifts 2px on hover.
 */
export function NotebookCard({
  notebook,
  renaming = false,
  onRenameDone,
  compact = false,
  dragHandle,
  className,
  ...handlers
}: NotebookCardProps) {
  return (
    <article
      data-slot="notebook-card"
      className={cn(
        "group relative flex flex-col gap-2 rounded-md border border-rule bg-sheet shadow-1",
        "transition-[translate,box-shadow,border-color] duration-(--dur-fast) ease-out",
        "hover:-translate-y-0.5 hover:shadow-2 active:translate-y-[-1px] motion-reduce:hover:translate-y-0",
        "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-(--ring)",
        compact ? "p-3" : "p-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <ColorDot color={notebook.color} />
        <span className="min-w-0 flex-1 truncate text-small text-graphite">
          {notebook.subject ?? "No subject"}
        </span>
        {dragHandle}
        <NotebookMenu notebook={notebook} {...handlers} />
      </div>

      {renaming ? (
        <RenameInput title={notebook.title} onDone={(t) => onRenameDone?.(t)} />
      ) : (
        <h3 className="text-h3 text-ink">
          <Link
            href={`/app/notebooks/${notebook.id}`}
            className="line-clamp-2 outline-none after:absolute after:inset-0 after:rounded-md"
          >
            {notebook.title}
          </Link>
        </h3>
      )}

      {!compact && notebook.description && (
        <p className="line-clamp-2 text-body text-graphite">{notebook.description}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-1">
        <span className="text-small text-graphite tabular-nums">{metaLine(notebook)}</span>
        <StatusWord status={notebook.status} />
      </div>
    </article>
  );
}

function RenameInput({ title, onDone }: { title: string; onDone: (title: string | null) => void }) {
  const [value, setValue] = useState(title);
  // Enter or Esc unmounts the input, and some browsers then fire blur: finish only once.
  const done = useRef(false);
  const finish = (next: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(next);
  };
  const changed = () => (value.trim() && value.trim() !== title ? value.trim() : null);
  return (
    <input
      aria-label="Notebook name"
      autoFocus
      value={value}
      maxLength={120}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(changed());
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          finish(null);
        }
      }}
      onBlur={() => finish(changed())}
      className="relative z-10 h-8 rounded-sm border border-primary bg-sheet px-2 text-h3 text-ink outline-none"
    />
  );
}

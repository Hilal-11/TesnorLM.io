import { BookOpen, Bookmark, GraduationCap, Repeat2, type LucideIcon } from "lucide-react";
import {
  COLOR_LABELS,
  COLOR_VARS,
  NOTEBOOK_COLORS,
  STATUS_LABELS,
  type NotebookColor,
  type NotebookStatus,
  type NotebookWithCounts,
} from "@/lib/notebooks/shared";
import { cn } from "@/lib/utils";

/** Status is always an icon and a word, never colour alone (skill 2.3). */
export const STATUS_ICONS: Record<NotebookStatus, LucideIcon> = {
  to_read: Bookmark,
  learning: BookOpen,
  reviewing: Repeat2,
  mastered: GraduationCap,
};

export function asColor(value: string): NotebookColor {
  return (NOTEBOOK_COLORS as readonly string[]).includes(value)
    ? (value as NotebookColor)
    : "graphite";
}

export function ColorDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: COLOR_VARS[asColor(color)] }}
    />
  );
}

export function colorName(color: string) {
  return COLOR_LABELS[asColor(color)];
}

export function StatusWord({ status, className }: { status: NotebookStatus; className?: string }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-small text-graphite", className)}>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** "12 Dec", or "12 Dec 2027" when it isn't this year. Dates are stored as YYYY-MM-DD. */
export function formatExamDate(value: string, now = new Date()) {
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(y !== now.getFullYear() ? { year: "numeric" } : {}),
  }).format(date);
}

/** "3 sources · Exam 12 Dec", "1 source", "No sources yet". */
export function metaLine(n: Pick<NotebookWithCounts, "source_count" | "exam_date">) {
  const sources =
    n.source_count === 0
      ? "No sources yet"
      : `${n.source_count} ${n.source_count === 1 ? "source" : "sources"}`;
  return n.exam_date ? `${sources} · Exam ${formatExamDate(n.exam_date)}` : sources;
}

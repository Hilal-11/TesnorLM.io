/**
 * Notebook vocabulary, validation and pure list helpers, shared by server and client.
 * Statuses and colours mirror migration 0004 (a test checks the status enum).
 */
import { generateKeyBetween } from "fractional-indexing";
import { z } from "zod";
import type { Database } from "@/lib/database.types";

export type Notebook = Database["public"]["Tables"]["notebooks"]["Row"];
export type NotebookWithCounts = Notebook & { source_count: number };

export const NOTEBOOK_STATUSES = ["to_read", "learning", "reviewing", "mastered"] as const;
export type NotebookStatus = (typeof NOTEBOOK_STATUSES)[number];
export const STATUS_LABELS: Record<NotebookStatus, string> = {
  to_read: "To read",
  learning: "Learning",
  reviewing: "Reviewing",
  mastered: "Mastered",
};

/** Palette token names (design skill 2.4); the UI maps them to --chart-1…5, never hex. */
export const NOTEBOOK_COLORS = ["cobalt", "teal", "amber", "rose", "graphite"] as const;
export type NotebookColor = (typeof NOTEBOOK_COLORS)[number];
export const COLOR_LABELS: Record<NotebookColor, string> = {
  cobalt: "Cobalt",
  teal: "Teal",
  amber: "Amber",
  rose: "Rose",
  graphite: "Graphite",
};
export const COLOR_VARS: Record<NotebookColor, string> = {
  cobalt: "var(--chart-1)",
  teal: "var(--chart-2)",
  amber: "var(--chart-3)",
  rose: "var(--chart-4)",
  graphite: "var(--chart-5)",
};

export const SUBJECT_PRESETS = [
  "Machine learning & AI",
  "Computer science",
  "Mathematics",
  "Physics",
  "Biology",
  "Electronics",
] as const;

export const NOTEBOOK_SORTS = ["last_opened", "title", "exam_date", "created"] as const;
export type NotebookSort = (typeof NOTEBOOK_SORTS)[number];
export const SORT_LABELS: Record<NotebookSort, string> = {
  last_opened: "Last opened",
  title: "Name",
  exam_date: "Exam date",
  created: "Date created",
};

// ───────────── Validation ─────────────

const blankToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

/** Optional text: blank means "clear it" (null); absent means "leave it". */
const optionalText = (max: number) =>
  z
    .preprocess(
      blankToNull,
      z.string().trim().max(max, `Use ${max} characters or fewer.`).nullable(),
    )
    .optional();

const title = z
  .string()
  .trim()
  .min(1, "Give the notebook a name.")
  .max(120, "Use 120 characters or fewer.");
const examDate = z
  .preprocess(blankToNull, z.iso.date("Use a date like 2026-12-12.").nullable())
  .optional();

export const notebookCreateSchema = z.strictObject({
  title,
  description: optionalText(500),
  subject: optionalText(60),
  color: z.enum(NOTEBOOK_COLORS).default("cobalt"),
  exam_date: examDate,
  status: z.enum(NOTEBOOK_STATUSES).default("to_read"),
});
export type NotebookCreate = z.infer<typeof notebookCreateSchema>;

export const notebookPatchSchema = z
  .strictObject({
    title: title.optional(),
    description: optionalText(500),
    subject: optionalText(60),
    color: z.enum(NOTEBOOK_COLORS).optional(),
    exam_date: examDate,
  })
  .refine((patch) => Object.values(patch).some((v) => v !== undefined), "Nothing to save.");
export type NotebookPatch = z.infer<typeof notebookPatchSchema>;

export const notebookUpdateSchema = z.strictObject({
  id: z.uuid(),
  updatedAt: z.string().min(1),
  patch: notebookPatchSchema,
});

export const notebookMoveSchema = z.strictObject({
  id: z.uuid(),
  status: z.enum(NOTEBOOK_STATUSES),
  /** The card that ends up just above (lower position) and just below, if any. */
  beforeId: z.uuid().nullable().optional(),
  afterId: z.uuid().nullable().optional(),
});
export type NotebookMove = z.infer<typeof notebookMoveSchema>;

export const notebookIdSchema = z.strictObject({ id: z.uuid() });
export const notebookIdsSchema = z.strictObject({ ids: z.array(z.uuid()).min(1).max(100) });

export const notebookFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(NOTEBOOK_STATUSES).optional(),
  subject: z.string().trim().max(60).optional(),
  sort: z.enum(NOTEBOOK_SORTS).optional(),
});
export type NotebookFilters = z.infer<typeof notebookFiltersSchema>;

// ───────────── Ordering ─────────────

/**
 * A board position between two neighbours (either may be missing). Positions compare byte by byte
 * (the column uses the "C" collation), which is how JavaScript compares these ASCII strings.
 * Inconsistent neighbours (lower ≥ upper, from a concurrent move) fall back to "just after lower".
 */
export function positionBetween(lower: string | null, upper: string | null): string {
  if (lower !== null && upper !== null && lower >= upper) return generateKeyBetween(lower, null);
  return generateKeyBetween(lower, upper);
}

/** Board order: position, then id so ties (concurrent moves) stay stable. */
export function compareBoardOrder(a: Pick<Notebook, "position" | "id">, b: typeof a) {
  if (a.position !== b.position) return a.position < b.position ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// ───────────── Filtering and sorting (lists are per person, so this runs in memory) ─────────────

export function filterNotebooks<T extends Notebook>(list: T[], filters: NotebookFilters): T[] {
  const q = filters.q?.trim().toLocaleLowerCase();
  return list.filter(
    (n) =>
      (!filters.status || n.status === filters.status) &&
      (!filters.subject || n.subject === filters.subject) &&
      (!q ||
        [n.title, n.description, n.subject].some((field) =>
          field?.toLocaleLowerCase().includes(q),
        )),
  );
}

const time = (value: string | null) => (value ? Date.parse(value) : Number.NEGATIVE_INFINITY);

export function sortNotebooks<T extends Notebook>(list: T[], sort: NotebookSort = "last_opened") {
  const sorted = [...list];
  switch (sort) {
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
    case "exam_date":
      return sorted.sort((a, b) => {
        if (a.exam_date === b.exam_date) return time(b.created_at) - time(a.created_at);
        if (!a.exam_date) return 1;
        if (!b.exam_date) return -1;
        return a.exam_date < b.exam_date ? -1 : 1;
      });
    case "created":
      return sorted.sort((a, b) => time(b.created_at) - time(a.created_at));
    default:
      return sorted.sort(
        (a, b) =>
          time(b.last_opened_at) - time(a.last_opened_at) ||
          time(b.created_at) - time(a.created_at),
      );
  }
}

export function countByStatus(list: Pick<Notebook, "status">[]) {
  const counts = Object.fromEntries(NOTEBOOK_STATUSES.map((s) => [s, 0])) as Record<
    NotebookStatus,
    number
  >;
  for (const n of list) counts[n.status] += 1;
  return counts;
}

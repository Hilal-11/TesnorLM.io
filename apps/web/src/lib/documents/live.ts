/**
 * The sources panel's live list (spec sections 3 step 7, 5). Realtime events and polls can arrive
 * late or out of order; these rules keep what people see honest:
 *
 * - An update from an older run (lower `attempt`) is ignored.
 * - Within a run, the stage never moves backwards and progress never drops.
 * - A deleted row (soft or hard) leaves the list at once.
 */
import {
  STAGES,
  detailLine,
  errorCopy,
  isTerminal,
  uiWord,
  type Stage,
} from "@/lib/ingestion/contract";
import type { DocumentStatus } from "@/components/ui/status-pill";
import type { Source } from "./shared";

const ORDER = new Map(STAGES.map((s, i) => [s, i]));

/** Merges one incoming row into the current one. Returns the row to keep. */
export function mergeSource(current: Source | undefined, incoming: Source): Source {
  if (!current) return incoming;
  if (incoming.attempt < current.attempt) return current; // stale run
  if (incoming.ingest_run_id !== current.ingest_run_id) {
    return incoming.attempt > current.attempt ? incoming : current;
  }
  const from = ORDER.get(current.stage) ?? 0;
  const to = ORDER.get(incoming.stage) ?? 0;
  if (isTerminal(current.stage) && current.stage !== incoming.stage) {
    return { ...current, ...pickNonPipeline(incoming) }; // a run never leaves ready/failed
  }
  if (to < from) return { ...current, ...pickNonPipeline(incoming) };
  return {
    ...incoming,
    progress: to === from ? Math.max(current.progress, incoming.progress) : incoming.progress,
  };
}

/** Fields people change themselves (rename), safe to take from any event. */
function pickNonPipeline(row: Source): Partial<Source> {
  return { title: row.title, deleted_at: row.deleted_at, updated_at: row.updated_at };
}

export type SourceList = Source[];

/** Applies an insert/update/delete to the list (sorted by creation). */
export function applyChange(
  list: SourceList,
  change: { type: "upsert"; row: Source } | { type: "delete"; id: string },
): SourceList {
  if (change.type === "delete") return list.filter((s) => s.id !== change.id);
  const { row } = change;
  if (row.deleted_at) return list.filter((s) => s.id !== row.id);
  const index = list.findIndex((s) => s.id === row.id);
  if (index === -1) {
    return [...list, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  const merged = mergeSource(list[index], row);
  if (merged === list[index]) return list;
  const next = [...list];
  next[index] = merged;
  return next;
}

/** A full refresh (polling): every row goes through the same merge rules. */
export function applySnapshot(list: SourceList, rows: Source[]): SourceList {
  const current = new Map(list.map((s) => [s.id, s]));
  return rows
    .filter((r) => !r.deleted_at)
    .map((r) => mergeSource(current.get(r.id), r))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export type SourceStatus = {
  /** StatusPill status: the visual group of the stage (icon, colour, spinner). */
  pill: DocumentStatus;
  word: string;
  /** The line under the name: a real count, the ready summary, or the error's reason. */
  line: string;
  /** Error fix and actions (failed only). */
  fix?: string;
  actions?: { id: string; label: string }[];
  /** 0–100, or null when there's nothing honest to show. */
  progress: number | null;
};

/** Which pill a stage shows. Working stages spin; a password wait is a caution, not a failure. */
const PILLS: Record<Stage, DocumentStatus> = {
  uploading: "uploading",
  queued: "queued",
  validating: "reading",
  repairing: "reading",
  needs_password: "needs_password",
  parsing_fast: "reading",
  fast_ready: "reading",
  parsing_deep: "reading",
  ocr: "reading",
  reading_figures: "reading",
  indexing: "indexing",
  ready: "ready",
  failed: "failed",
};

/** What a source card says. `uploadPercent` comes from this browser's upload, if it's ours. */
export function sourceStatus(source: Source, uploadPercent?: number): SourceStatus {
  const stage = source.stage as Stage;
  const word = uiWord(stage);
  const pill = PILLS[stage] ?? "reading";
  if (stage === "failed") {
    const copy = errorCopy(source.error_code, (source.error_vars ?? {}) as Record<string, unknown>);
    return { pill, word, line: copy.message, fix: copy.fix, actions: copy.actions, progress: null };
  }
  if (stage === "ready") {
    return {
      pill,
      word,
      line: detailLine("ready", { pages: source.page_count ?? undefined }),
      progress: null,
    };
  }
  if (stage === "uploading") {
    const percent = uploadPercent === undefined ? undefined : Math.floor(uploadPercent);
    return { pill, word, line: detailLine("uploading", { percent }), progress: percent ?? null };
  }
  return {
    pill,
    word,
    line: source.stage_detail ?? detailLine(stage),
    progress: stage === "queued" ? null : source.progress,
  };
}

/** "(2 reading) Notebook — TensorLM" while sources are busy and the tab is in the background. */
export function backgroundTitle(title: string, sources: Source[]) {
  const busy = sources.filter((s) => !isTerminal(s.stage as Stage));
  if (busy.length === 0) return `${title} — TensorLM`;
  const word = busy.every((s) => s.stage === "uploading") ? "uploading" : "reading";
  return `(${busy.length} ${word}) ${title} — TensorLM`;
}

/** Stage timeline for the detail panel: each stage that ran, in order, with its duration. */
export function stageTimeline(source: Source) {
  const timings = (source.stage_timings ?? {}) as Record<
    string,
    { started_at?: string; duration_ms?: number }
  >;
  return STAGES.filter((s) => timings[s])
    .map((stage) => ({
      stage,
      word: uiWord(stage),
      startedAt: timings[stage].started_at ?? null,
      durationMs: timings[stage].duration_ms ?? null,
    }))
    .sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""));
}

/** "1.4 s", "2 min 05 s", "—". */
export function formatDuration(ms: number | null) {
  if (ms === null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.max(0, Math.round(ms))} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1).replace(/\.0$/, "")} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes} min ${String(seconds).padStart(2, "0")} s`;
}

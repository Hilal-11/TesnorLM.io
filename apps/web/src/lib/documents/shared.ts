/**
 * Sources (documents) vocabulary shared by the API, the upload manager and the sources panel.
 * Stage names, words, detail lines and error copy all come from the ingestion contract.
 */
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { LIMITS, isTerminal, type Stage } from "@/lib/ingestion/contract";

export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

/** What the sources panel reads (no markdown, no embeddings). */
export const SOURCE_FIELDS =
  "id, notebook_id, user_id, title, original_filename, file_size, page_count, stage, progress, " +
  "stage_detail, error_code, error_vars, ingest_run_id, ready_run_id, attempt, ocr_used, " +
  "figure_count, chunk_count, stage_timings, started_at, finished_at, created_at, updated_at, deleted_at";

export type Source = Pick<
  DocumentRow,
  | "id"
  | "notebook_id"
  | "user_id"
  | "title"
  | "original_filename"
  | "file_size"
  | "page_count"
  | "stage"
  | "progress"
  | "stage_detail"
  | "error_code"
  | "error_vars"
  | "ingest_run_id"
  | "ready_run_id"
  | "attempt"
  | "ocr_used"
  | "figure_count"
  | "chunk_count"
  | "stage_timings"
  | "started_at"
  | "finished_at"
  | "created_at"
  | "updated_at"
  | "deleted_at"
>;

export const MB = 1024 * 1024;

/** "63.4" (no trailing ".0"): the contract's {sizeMb} values are preformatted strings. */
export function sizeMb(bytes: number) {
  return (bytes / MB).toFixed(1).replace(/\.0$/, "");
}

/** "2.4 MB", "820 KB". */
export function formatBytes(bytes: number) {
  if (bytes >= MB) return `${sizeMb(bytes)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const isPdfName = (name: string) => /\.pdf$/i.test(name.trim());

/** "attention-is-al…ed.pdf": keeps the start and the extension visible (skill 10.1). */
export function middleTruncate(name: string, max = 28) {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : "";
  const keep = max - ext.length - 1;
  const head = Math.ceil(keep * 0.6);
  const tail = keep - head;
  const stem = ext ? name.slice(0, dot) : name;
  return `${stem.slice(0, head)}…${stem.slice(stem.length - tail)}${ext}`;
}

export const createDocumentSchema = z.strictObject({
  filename: z.string().trim().min(1).max(255),
  size: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  /** "Add anyway": skip the duplicate check. */
  force: z.boolean().optional(),
});
export type CreateDocument = z.infer<typeof createDocumentSchema>;

export type CreatedDocument = {
  documentId: string;
  runId: string;
  storagePath: string;
  bucket: string;
};

/** Whether a stage is still moving (the panel keeps watching it). */
export const isActive = (stage: Stage) => !isTerminal(stage);

export const LIMIT_DEFAULTS = LIMITS;

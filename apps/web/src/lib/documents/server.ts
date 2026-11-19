import "server-only";
/**
 * Source lifecycle on the server (spec sections 3 and 11). Every function takes the caller's
 * client (RLS decides what they can see: someone else's document is a 404) and uses the
 * service-role client only after that ownership check, for pipeline columns and storage.
 */
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { AppError, notFound, upstreamError } from "@/lib/errors";
import { sendEvent } from "@/lib/events";
import { LIMITS, STORAGE, errorCopy, storagePath, type ErrorCode } from "@/lib/ingestion/contract";
import { getNotebook } from "@/lib/notebooks/repo";
import { RUN_STAGES } from "@/lib/sweepers";
import { logger } from "@/lib/logger";
import {
  SOURCE_FIELDS,
  isPdfName,
  sizeMb,
  type CreateDocument,
  type CreatedDocument,
  type Source,
} from "./shared";

type Db = SupabaseClient<Database>;

/** Where the original lives: always derived on the server from ids, never from client input. */
export const sourcePath = (doc: Pick<Source, "user_id" | "id">) =>
  storagePath("source", { userId: doc.user_id, documentId: doc.id });

const envInt = (name: string, fallback: number) => {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
export const maxUploadBytes = () => envInt("MAX_UPLOAD_MB", LIMITS.maxUploadMb) * 1024 * 1024;
export const maxSources = () => envInt("MAX_SOURCES_FREE", LIMITS.maxSourcesFree);
export const REPROCESS_PER_HOUR = 3;

/** An ingestion error with the contract's copy: message, fix, values and actions. */
export function ingestionError(
  code: ErrorCode,
  status: number,
  vars: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
) {
  const copy = errorCopy(code, vars);
  return new AppError(code, copy.message, status, {
    fix: copy.fix,
    vars,
    actions: copy.actions,
    ...extra,
  });
}

/** One of the person's documents (RLS-scoped), or a 404. Deleted ones only when asked. */
export async function getSource(db: Db, id: string, { deleted = false } = {}): Promise<Source> {
  let query = db.from("documents").select(SOURCE_FIELDS).eq("id", id);
  if (!deleted) query = query.is("deleted_at", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("We couldn't find that source.");
  return data as unknown as Source;
}

export async function listSources(db: Db, notebookId: string): Promise<Source[]> {
  const { data, error } = await db
    .from("documents")
    .select(SOURCE_FIELDS)
    .eq("notebook_id", notebookId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Source[];
}

/** POST /api/notebooks/:id/documents — checks, then a row in `uploading` (spec section 3, step 2). */
export async function createDocument(
  db: Db,
  user: User,
  notebookId: string,
  input: CreateDocument,
): Promise<CreatedDocument> {
  const notebook = await getNotebook(db, notebookId);
  if (!notebook) throw notFound("We couldn't find that notebook.");

  if (!isPdfName(input.filename)) throw ingestionError("not_pdf", 415);
  const limit = maxUploadBytes();
  if (input.size > limit) {
    throw ingestionError("file_too_large", 413, {
      sizeMb: sizeMb(input.size),
      limitMb: sizeMb(limit),
    });
  }

  // Quota: live sources that aren't failed (spec section 7).
  const { count, error: countError } = await db
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("notebook_id", notebookId)
    .is("deleted_at", null)
    .neq("stage", "failed");
  if (countError) throw countError;
  if ((count ?? 0) >= maxSources()) {
    throw ingestionError("quota_exceeded", 403, { limit: maxSources() });
  }

  if (!input.force) {
    const { data: existing, error } = await db
      .from("documents")
      .select("id, title")
      .eq("notebook_id", notebookId)
      .eq("sha256", input.sha256)
      .is("deleted_at", null)
      .neq("stage", "failed")
      .limit(1);
    if (error) throw error;
    if (existing && existing.length > 0) {
      throw ingestionError("duplicate_file", 409, {}, { existingId: existing[0].id });
    }
  }

  // RLS + column grants: people may insert only these columns; a trigger sets the stage, the run
  // id and the storage path ({userId}/{documentId}/source.pdf) whatever is sent.
  const { data, error } = await db
    .from("documents")
    .insert({
      notebook_id: notebookId,
      user_id: user.id,
      title: input.filename,
      original_filename: input.filename,
      mime_type: "application/pdf",
      file_size: input.size,
      sha256: input.sha256,
    } as Database["public"]["Tables"]["documents"]["Insert"])
    .select("id, ingest_run_id, storage_path")
    .single();
  if (error) throw error;
  return {
    documentId: data.id,
    runId: data.ingest_run_id,
    storagePath: data.storage_path,
    bucket: STORAGE.bucket,
  };
}

/** The stored object's size, or null when it isn't there. */
export async function storedSize(admin: Db, path: string): Promise<number | null> {
  const slash = path.lastIndexOf("/");
  const { data, error } = await admin.storage
    .from(STORAGE.bucket)
    .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 10 });
  if (error) throw error;
  const item = (data ?? []).find((f) => f.name === path.slice(slash + 1) && f.id !== null);
  const size = (item?.metadata as { size?: number } | null)?.size;
  return item ? (typeof size === "number" ? size : 0) : null;
}

async function queue(doc: Source, runId: string) {
  const sent = await sendEvent(
    "uploaded",
    { document_id: doc.id, notebook_id: doc.notebook_id, user_id: doc.user_id, run_id: runId },
    `uploaded-${runId}`,
  );
  if (!sent) throw upstreamError("We couldn't start reading this file. Try again in a moment.");
}

/** POST /api/documents/:id/uploaded — the object is there: queue it (idempotent). */
export async function confirmUploaded(db: Db, admin: Db, id: string) {
  const doc = await getSource(db, id);
  if (doc.stage === "uploading") {
    const size = await storedSize(admin, sourcePath(doc));
    if (size === null || (doc.file_size !== null && size !== doc.file_size)) {
      throw ingestionError("upload_interrupted", 409);
    }
    const { error } = await admin.rpc("set_document_stage", {
      p_document_id: doc.id,
      p_run_id: doc.ingest_run_id,
      p_stage: "queued",
    });
    if (error) throw error;
  } else if (doc.stage !== "queued") {
    // Already past the queue (a double click after it started): nothing to do.
    return { stage: doc.stage };
  }
  await queue(doc, doc.ingest_run_id);
  return { stage: "queued" as const };
}

/** POST /api/documents/:id/cancel — stop an upload: the partial object and the row go. */
export async function cancelUpload(db: Db, admin: Db, id: string) {
  const doc = await getSource(db, id);
  if (doc.stage !== "uploading") {
    throw new AppError(
      "not_uploading",
      "This file has finished uploading. Delete it instead.",
      409,
    );
  }
  const removed = await admin.storage.from(STORAGE.bucket).remove([sourcePath(doc)]);
  if (removed.error) throw removed.error;
  const { error } = await admin
    .from("documents")
    .delete()
    .eq("id", doc.id)
    .eq("stage", "uploading");
  if (error) throw error;
  return { ok: true };
}

/**
 * POST /api/documents/:id/reprocess — a new run (spec section 11): new run id, attempt + 1,
 * `queued`; the old run is cancelled; its chunks stay searchable until the new run finishes.
 * At most REPROCESS_PER_HOUR per document per hour.
 */
export async function reprocess(db: Db, admin: Db, id: string, now = Date.now()) {
  const doc = await getSource(db, id);
  if (doc.stage === "uploading") {
    throw new AppError("not_uploaded", "This file hasn't finished uploading yet.", 409);
  }
  const { data: full, error: readError } = await admin
    .from("documents")
    .select("reprocessed_at")
    .eq("id", doc.id)
    .single();
  if (readError) throw readError;
  const recent = (full.reprocessed_at ?? []).filter((t) => now - Date.parse(t) < 60 * 60 * 1000);
  if (recent.length >= REPROCESS_PER_HOUR) {
    throw new AppError(
      "rate_limited",
      `You can try this file again ${REPROCESS_PER_HOUR} times an hour. Wait a little, then try again.`,
      429,
    );
  }
  return startRun(admin, doc, [...recent, new Date(now).toISOString()]);
}

async function startRun(admin: Db, doc: Source, reprocessedAt?: string[]) {
  const { data: runId, error } = await admin.rpc("start_ingest_run", { p_document_id: doc.id });
  if (error) throw error;
  if (!runId) throw notFound("We couldn't find that source.");
  if (reprocessedAt) {
    const res = await admin
      .from("documents")
      .update({ reprocessed_at: reprocessedAt })
      .eq("id", doc.id);
    if (res.error) throw res.error;
  }
  const data = {
    document_id: doc.id,
    notebook_id: doc.notebook_id,
    user_id: doc.user_id,
    run_id: runId,
  };
  // Cancel the old run first (cancelOn matches a different run id, so order doesn't matter).
  await sendEvent("reprocess", data, `reprocess-${runId}`);
  await queue(doc, runId);
  logger.info("ingest run started", { documentId: doc.id, runId, attempt: doc.attempt + 1 });
  return { runId, stage: "queued" as const };
}

/** DELETE /api/documents/:id — soft delete; hidden and out of search at once (Undo restores). */
export async function softDelete(db: Db, id: string) {
  const doc = await getSource(db, id);
  if (doc.stage === "uploading") {
    throw new AppError("not_uploaded", "Cancel the upload instead.", 409);
  }
  const { error } = await db
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", doc.id);
  if (error) throw error;
  await sendEvent("deleted", {
    document_id: doc.id,
    notebook_id: doc.notebook_id,
    user_id: doc.user_id,
  });
  return { id: doc.id };
}

/** POST /api/documents/:id/restore — Undo. A run that was cut short by the delete starts again. */
export async function restore(db: Db, admin: Db, id: string) {
  const doc = await getSource(db, id, { deleted: true });
  if (!doc.deleted_at) return { id: doc.id, restarted: false };
  const { error } = await db.from("documents").update({ deleted_at: null }).eq("id", doc.id);
  if (error) throw error;
  const interrupted = RUN_STAGES.includes(doc.stage);
  if (interrupted) await startRun(admin, { ...doc, deleted_at: null });
  return { id: doc.id, restarted: interrupted };
}

/** Undo of a notebook delete restarts runs its delete cancelled. */
export async function restartInterruptedRuns(admin: Db, notebookId: string) {
  const { data, error } = await admin
    .from("documents")
    .select(SOURCE_FIELDS)
    .eq("notebook_id", notebookId)
    .is("deleted_at", null)
    .in("stage", RUN_STAGES);
  if (error) throw error;
  for (const doc of (data ?? []) as unknown as Source[]) await startRun(admin, doc);
  return data?.length ?? 0;
}

/** GET /api/documents/:id/download — a 60-second signed link with the original file name. */
export async function downloadUrl(db: Db, admin: Db, id: string) {
  const doc = await getSource(db, id);
  if (doc.stage === "uploading") throw notFound("This file hasn't finished uploading.");
  const { data, error } = await admin.storage
    .from(STORAGE.bucket)
    .createSignedUrl(sourcePath(doc), 60, {
      download: doc.original_filename,
    });
  if (error || !data) throw error ?? new Error("no signed url");
  return { url: data.signedUrl, expiresIn: 60 };
}

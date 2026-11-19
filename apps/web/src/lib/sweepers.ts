/**
 * Cron sweepers (spec section 11). Service-role only; every function is safe to repeat.
 *
 * - Stale uploads: documents still `uploading` after 2 h fail with `upload_interrupted`, and the
 *   partial object is removed.
 * - Stuck runs: documents in any other non-terminal stage for 2 h fail with `internal` (logged).
 * - Orphans: storage folders `{userId}/{documentId}/…` whose document row is gone, older than
 *   24 h, are deleted from both buckets.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { removePrefix } from "@/lib/cleanup";
import { STORAGE } from "@/lib/ingestion/contract";

type Admin = SupabaseClient<Database>;

export const STALE_UPLOAD_MS = 2 * 60 * 60 * 1000;
export const STUCK_RUN_MS = 2 * 60 * 60 * 1000;
export const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

const NON_TERMINAL = ["queued", "validating", "parsing", "ocr", "reading_figures", "indexing"] as const;

async function failRun(admin: Admin, id: string, runId: string, code: string) {
  const { error } = await admin.rpc("set_document_stage", {
    p_document_id: id,
    p_run_id: runId,
    p_stage: "failed",
    p_error_code: code,
  });
  if (error) throw error;
}

export async function sweepStaleUploads(admin: Admin, now = Date.now()) {
  const cutoff = new Date(now - STALE_UPLOAD_MS).toISOString();
  const { data, error } = await admin
    .from("documents")
    .select("id, ingest_run_id, storage_path, created_at")
    .eq("stage", "uploading")
    .lt("created_at", cutoff)
    .limit(500);
  if (error) throw error;
  for (const doc of data ?? []) {
    await failRun(admin, doc.id, doc.ingest_run_id, "upload_interrupted");
    const removed = await admin.storage.from(STORAGE.bucket).remove([doc.storage_path]);
    if (removed.error) throw removed.error;
  }
  return { failed: data?.length ?? 0 };
}

/** Runs whose current stage started more than 2 h ago and never finished. */
export async function sweepStuckRuns(admin: Admin, now = Date.now()) {
  const cutoff = new Date(now - STUCK_RUN_MS).toISOString();
  const { data, error } = await admin
    .from("documents")
    .select("id, ingest_run_id, updated_at")
    .in("stage", [...NON_TERMINAL])
    .is("deleted_at", null)
    .lt("updated_at", cutoff)
    .limit(500);
  if (error) throw error;
  for (const doc of data ?? []) await failRun(admin, doc.id, doc.ingest_run_id, "internal");
  return { failed: data?.length ?? 0, ids: (data ?? []).map((d) => d.id) };
}

type Folder = { userId: string; documentId: string };

async function listFolders(admin: Admin, bucket: string, path: string) {
  const names: { name: string; isFolder: boolean; createdAt: string | null }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(path, { limit: 1000, offset });
    if (error) throw error;
    for (const item of data ?? []) {
      names.push({ name: item.name, isFolder: item.id === null, createdAt: item.created_at });
    }
    if (!data || data.length < 1000) break;
  }
  return names;
}

/** Newest object time under a folder (an orphan must be idle for 24 h, uploads included). */
async function newestObject(admin: Admin, bucket: string, prefix: string): Promise<number> {
  let newest = 0;
  const folders = [prefix];
  while (folders.length > 0) {
    const folder = folders.pop()!;
    for (const item of await listFolders(admin, bucket, folder)) {
      if (item.isFolder) folders.push(`${folder}/${item.name}`);
      else if (item.createdAt) newest = Math.max(newest, Date.parse(item.createdAt));
    }
  }
  return newest;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function sweepOrphans(admin: Admin, now = Date.now()) {
  let removed = 0;
  for (const bucket of [STORAGE.bucket, STORAGE.artifactsBucket]) {
    const candidates: Folder[] = [];
    for (const user of await listFolders(admin, bucket, "")) {
      if (!user.isFolder || !UUID.test(user.name)) continue;
      for (const doc of await listFolders(admin, bucket, user.name)) {
        if (doc.isFolder && UUID.test(doc.name))
          candidates.push({ userId: user.name, documentId: doc.name });
      }
    }
    for (let i = 0; i < candidates.length; i += 200) {
      const batch = candidates.slice(i, i + 200);
      const { data, error } = await admin
        .from("documents")
        .select("id")
        .in(
          "id",
          batch.map((c) => c.documentId),
        );
      if (error) throw error;
      const live = new Set((data ?? []).map((d) => d.id));
      for (const folder of batch) {
        if (live.has(folder.documentId)) continue;
        const prefix = `${folder.userId}/${folder.documentId}`;
        if (now - (await newestObject(admin, bucket, prefix)) < ORPHAN_AGE_MS) continue;
        removed += await removePrefix(admin, bucket, prefix);
      }
    }
  }
  return { removed };
}

/**
 * Hard deletion after the Undo window: storage files first, then rows (chunks and figures
 * cascade). Runs with the service-role client from queue functions and sweepers only. Every
 * function is safe to repeat and does nothing if the item was restored in the meantime.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { STORAGE } from "@/lib/ingestion/contract";

type Admin = SupabaseClient<Database>;

/** Every object under a folder (Storage lists one level at a time). */
export async function listPrefix(admin: Admin, bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  const folders = [prefix.replace(/\/+$/, "")];
  while (folders.length > 0) {
    const folder = folders.pop()!;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.storage
        .from(bucket)
        .list(folder, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      for (const item of data ?? []) {
        const path = `${folder}/${item.name}`;
        if (item.id === null) folders.push(path);
        else files.push(path);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return files;
}

export async function removePrefix(admin: Admin, bucket: string, prefix: string) {
  const files = await listPrefix(admin, bucket, prefix);
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await admin.storage.from(bucket).remove(files.slice(i, i + 100));
    if (error) throw error;
  }
  return files.length;
}

/** The original, figures and parsed artifacts of one document, in both buckets. */
export async function removeDocumentFiles(admin: Admin, userId: string, documentId: string) {
  const prefix = `${userId}/${documentId}`;
  return (
    (await removePrefix(admin, STORAGE.bucket, prefix)) +
    (await removePrefix(admin, STORAGE.artifactsBucket, prefix))
  );
}

export type CleanupResult =
  | { status: "gone" }
  | { status: "restored" }
  | { status: "deleted"; documents: number; files: number };

export async function hardDeleteDocument(admin: Admin, documentId: string): Promise<CleanupResult> {
  const { data: doc, error } = await admin
    .from("documents")
    .select("id, user_id, deleted_at")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw error;
  if (!doc) return { status: "gone" };
  if (!doc.deleted_at) return { status: "restored" };
  const files = await removeDocumentFiles(admin, doc.user_id, doc.id);
  const del = await admin.from("documents").delete().eq("id", doc.id);
  if (del.error) throw del.error;
  return { status: "deleted", documents: 1, files };
}

export async function hardDeleteNotebook(admin: Admin, notebookId: string): Promise<CleanupResult> {
  const { data: notebook, error } = await admin
    .from("notebooks")
    .select("id, user_id, deleted_at")
    .eq("id", notebookId)
    .maybeSingle();
  if (error) throw error;
  if (!notebook) return { status: "gone" };
  if (!notebook.deleted_at) return { status: "restored" };

  const { data: docs, error: docsError } = await admin
    .from("documents")
    .select("id")
    .eq("notebook_id", notebook.id);
  if (docsError) throw docsError;
  let files = 0;
  for (const doc of docs ?? []) files += await removeDocumentFiles(admin, notebook.user_id, doc.id);
  const del = await admin.from("notebooks").delete().eq("id", notebook.id);
  if (del.error) throw del.error;
  return { status: "deleted", documents: docs?.length ?? 0, files };
}

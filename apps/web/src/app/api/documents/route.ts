import { z } from "zod";
import { requireUserForApi } from "@/lib/auth";
import { readEnv } from "@/lib/env";
import { badRequest, forbidden, upstreamError, withErrorHandling } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

const documentRequest = z.object({
  documentId: z.uuid(),
  notebookId: z.uuid(),
  title: z.string().trim().min(1).max(300),
  filePath: z.string().min(1).max(500),
  mimeType: z.string().max(120).optional(),
});

/**
 * Called after the browser uploaded a file to Storage at documents/<user_id>/<document_id>/<file>.
 * Creates the DB row and asks the Python worker to ingest it.
 */
export const POST = withErrorHandling("/api/documents", async (req: Request) => {
  const user = await requireUserForApi();
  const parsed = documentRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw badRequest("Send the uploaded file's details.");
  const { documentId, notebookId, title, filePath, mimeType } = parsed.data;

  // The worker downloads with the service role, so the path must be inside the caller's own folder.
  if (!filePath.startsWith(`${user.id}/${documentId}/`) || filePath.includes("..")) {
    throw forbidden("That file isn't in your uploads.");
  }

  const supabase = await createClient();
  const { data: notebook } = await supabase
    .from("notebooks")
    .select("id")
    .eq("id", notebookId)
    .maybeSingle();
  if (!notebook) throw forbidden("That notebook isn't yours.");

  const { error } = await supabase.from("documents").insert({
    id: documentId,
    notebook_id: notebookId,
    user_id: user.id,
    title,
    file_path: filePath,
    mime_type: mimeType,
  });
  if (error) throw badRequest("We couldn't add that source. Try again.", "insert_failed");

  const worker = readEnv("worker");
  const res = await fetch(`${worker.WORKER_URL}/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-worker-secret": worker.WORKER_SECRET },
    body: JSON.stringify({ document_id: documentId }),
  });
  if (!res.ok)
    throw upstreamError("We saved your source but couldn't start reading it. Try again shortly.");

  return Response.json({ ok: true, documentId });
});

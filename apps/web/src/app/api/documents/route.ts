import { createClient } from "@/lib/supabase/server";

/**
 * Called after the browser has uploaded a file to Storage at
 *   documents/<user_id>/<document_id>/<filename>
 * Creates the DB row and asks the Python worker to ingest it.
 */
export async function POST(req: Request) {
  const { documentId, notebookId, title, filePath, mimeType } = await req.json();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { error } = await supabase.from("documents").insert({
    id: documentId,
    notebook_id: notebookId,
    user_id: user.id,
    title,
    file_path: filePath,
    mime_type: mimeType,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  const res = await fetch(`${process.env.WORKER_URL}/ingest`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-secret": process.env.WORKER_SECRET!,
    },
    body: JSON.stringify({ document_id: documentId }),
  });
  if (!res.ok) return Response.json({ error: "worker unavailable" }, { status: 502 });

  return Response.json({ ok: true, documentId });
}

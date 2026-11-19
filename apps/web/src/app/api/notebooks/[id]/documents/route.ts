import { requireUserForApi } from "@/lib/auth";
import { createDocument, listSources } from "@/lib/documents/server";
import { idParam } from "@/lib/documents/route-helpers";
import { createDocumentSchema } from "@/lib/documents/shared";
import { badRequest, notFound, withErrorHandling } from "@/lib/errors";
import { getNotebook } from "@/lib/notebooks/repo";
import { createClient } from "@/lib/supabase/server";

/** GET — the notebook's live sources (polling fallback for the sources panel). */
export const GET = withErrorHandling(
  "/api/notebooks/[id]/documents",
  async (_req: Request, ctx: RouteContext<"/api/notebooks/[id]/documents">) => {
    await requireUserForApi();
    const id = await idParam(ctx.params);
    const db = await createClient();
    if (!(await getNotebook(db, id))) throw notFound("We couldn't find that notebook.");
    return Response.json({ sources: await listSources(db, id) });
  },
);

/**
 * POST {filename, size, sha256, force?} — registers an upload: ownership, size, type, quota and
 * duplicate checks; returns where to upload. The file itself goes straight to Storage (TUS).
 */
export const POST = withErrorHandling(
  "/api/notebooks/[id]/documents",
  async (req: Request, ctx: RouteContext<"/api/notebooks/[id]/documents">) => {
    const user = await requireUserForApi();
    const id = await idParam(ctx.params);
    const body = createDocumentSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw badRequest("Check the file details.");
    const created = await createDocument(await createClient(), user, id, body.data);
    return Response.json(created, { status: 201 });
  },
);

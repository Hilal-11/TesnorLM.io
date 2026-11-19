import { requireUserForApi } from "@/lib/auth";
import { confirmUploaded } from "@/lib/documents/server";
import { idParam } from "@/lib/documents/route-helpers";
import { withErrorHandling } from "@/lib/errors";
import { createAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** POST — the upload finished: check the stored object, queue the document (idempotent). */
export const POST = withErrorHandling(
  "/api/documents/[id]/uploaded",
  async (_req: Request, ctx: RouteContext<"/api/documents/[id]/uploaded">) => {
    await requireUserForApi();
    const id = await idParam(ctx.params);
    return Response.json(await confirmUploaded(await createClient(), createAdmin(), id));
  },
);

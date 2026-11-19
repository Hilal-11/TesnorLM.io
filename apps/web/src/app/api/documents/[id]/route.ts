import { requireUserForApi } from "@/lib/auth";
import { softDelete } from "@/lib/documents/server";
import { idParam } from "@/lib/documents/route-helpers";
import { withErrorHandling } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

/** DELETE — soft delete (hidden and out of search at once); the cleanup job removes it later. */
export const DELETE = withErrorHandling(
  "/api/documents/[id]",
  async (_req: Request, ctx: RouteContext<"/api/documents/[id]">) => {
    await requireUserForApi();
    const id = await idParam(ctx.params);
    return Response.json(await softDelete(await createClient(), id));
  },
);

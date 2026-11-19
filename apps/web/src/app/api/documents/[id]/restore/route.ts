import { requireUserForApi } from "@/lib/auth";
import { restore } from "@/lib/documents/server";
import { idParam } from "@/lib/documents/route-helpers";
import { withErrorHandling } from "@/lib/errors";
import { createAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** POST — Undo a delete (within the cleanup window). */
export const POST = withErrorHandling(
  "/api/documents/[id]/restore",
  async (_req: Request, ctx: RouteContext<"/api/documents/[id]/restore">) => {
    await requireUserForApi();
    const id = await idParam(ctx.params);
    return Response.json(await restore(await createClient(), createAdmin(), id));
  },
);

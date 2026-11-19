import { requireUserForApi } from "@/lib/auth";
import { reprocess } from "@/lib/documents/server";
import { idParam } from "@/lib/documents/route-helpers";
import { withErrorHandling } from "@/lib/errors";
import { createAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** POST — read the file again ("Try again"): a new run; at most 3 per document per hour. */
export const POST = withErrorHandling(
  "/api/documents/[id]/reprocess",
  async (_req: Request, ctx: RouteContext<"/api/documents/[id]/reprocess">) => {
    await requireUserForApi();
    const id = await idParam(ctx.params);
    return Response.json(await reprocess(await createClient(), createAdmin(), id));
  },
);

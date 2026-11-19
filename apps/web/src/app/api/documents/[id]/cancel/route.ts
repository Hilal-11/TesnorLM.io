import { requireUserForApi } from "@/lib/auth";
import { cancelUpload } from "@/lib/documents/server";
import { idParam } from "@/lib/documents/route-helpers";
import { withErrorHandling } from "@/lib/errors";
import { createAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** POST — cancel an upload in progress: removes the partial object and the row. */
export const POST = withErrorHandling(
  "/api/documents/[id]/cancel",
  async (_req: Request, ctx: RouteContext<"/api/documents/[id]/cancel">) => {
    await requireUserForApi();
    const id = await idParam(ctx.params);
    return Response.json(await cancelUpload(await createClient(), createAdmin(), id));
  },
);

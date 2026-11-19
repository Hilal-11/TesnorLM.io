import { requireUserForApi } from "@/lib/auth";
import { downloadUrl } from "@/lib/documents/server";
import { idParam } from "@/lib/documents/route-helpers";
import { withErrorHandling } from "@/lib/errors";
import { createAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** GET — the original file: a redirect to a 60-second signed link that keeps the file name. */
export const GET = withErrorHandling(
  "/api/documents/[id]/download",
  async (req: Request, ctx: RouteContext<"/api/documents/[id]/download">) => {
    await requireUserForApi();
    const id = await idParam(ctx.params);
    const { url, expiresIn } = await downloadUrl(await createClient(), createAdmin(), id);
    if (new URL(req.url).searchParams.get("json") === "1") return Response.json({ url, expiresIn });
    return new Response(null, {
      status: 303,
      headers: { location: url, "cache-control": "no-store" },
    });
  },
);

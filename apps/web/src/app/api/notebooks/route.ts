import { requireUserForApi } from "@/lib/auth";
import { badRequest, withErrorHandling } from "@/lib/errors";
import { listNotebooks } from "@/lib/notebooks/repo";
import { notebookFiltersSchema } from "@/lib/notebooks/shared";
import { createClient } from "@/lib/supabase/server";

/** GET /api/notebooks?q=&status=&subject=&sort= — the person's live notebooks (RLS-scoped). */
export const GET = withErrorHandling("/api/notebooks", async (req: Request) => {
  await requireUserForApi();
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const filters = notebookFiltersSchema.safeParse(params);
  if (!filters.success) throw badRequest("Check the filters.");
  const notebooks = await listNotebooks(await createClient(), filters.data);
  return Response.json({ notebooks });
});

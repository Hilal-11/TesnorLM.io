import { anthropic } from "@ai-sdk/anthropic";
import { repairDiagram, repairRequestSchema, saveRepair, saveRepairSchema } from "@/lib/answers/repair";
import { requireUserForApi } from "@/lib/auth";
import { badRequest, withErrorHandling } from "@/lib/errors";
import { MODELS } from "@/lib/models";
import { createAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

async function body<T>(req: Request, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw badRequest("That diagram request wasn't valid.");
  return parsed.data;
}

/** POST /api/diagram/repair {messageId, code, error} → {code: string | null}: one fast-model repair. */
export const POST = withErrorHandling("/api/diagram/repair", async (req: Request) => {
  await requireUserForApi();
  const input = await body(req, repairRequestSchema);
  const code = await repairDiagram({ db: await createClient(), model: anthropic(MODELS.fast) }, input);
  return Response.json({ code });
});

/** PUT /api/diagram/repair {messageId, from, to} → {saved}: keep the repaired code in the message. */
export const PUT = withErrorHandling("/api/diagram/repair", async (req: Request) => {
  await requireUserForApi();
  const input = await body(req, saveRepairSchema);
  const saved = await saveRepair({ db: await createClient(), admin: createAdmin() }, input);
  return Response.json({ saved });
});

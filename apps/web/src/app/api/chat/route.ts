import { anthropic } from "@ai-sdk/anthropic";
import { after } from "next/server";
import { respond, chatRequestSchema } from "@/lib/answers/respond";
import { requireUserForApi } from "@/lib/auth";
import { badRequest, withErrorHandling } from "@/lib/errors";
import { MODELS } from "@/lib/models";
import { embedQuery } from "@/lib/retrieval";
import { createAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

/**
 * POST /api/chat — one streamed answer (docs/specs/answers.md). Body: {chatId, message, level,
 * command?, attachments?, documentIds?, regenerateOf?, continueOf?}. Stop = abort the request: the
 * text so far is saved as "stopped".
 */
export const POST = withErrorHandling("/api/chat", async (req: Request) => {
  const user = await requireUserForApi();
  const parsed = chatRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    throw badRequest(parsed.error.issues[0]?.message ?? "Write a question first.");
  return respond(
    {
      db: await createClient(),
      admin: createAdmin(),
      userId: user.id,
      strong: anthropic(MODELS.strong),
      strongId: MODELS.strong,
      fast: anthropic(MODELS.fast),
      embed: embedQuery,
      later: (work) => after(work),
    },
    parsed.data,
    req.signal,
  );
});

import { generateText, type LanguageModel } from "ai";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "@/lib/errors";
import { FORMAT } from "./format.generated";
import { DIAGRAM_FIXER } from "@/prompts/helpers";

type Db = SupabaseClient<Database>;

const code = z.string().trim().min(1).max(4000);
export const repairRequestSchema = z.object({
  messageId: z.string().uuid(),
  code,
  error: z.string().max(500).default("render failed"),
});
export const saveRepairSchema = z.object({ messageId: z.string().uuid(), from: code, to: code });

/** The message must be the person's own assistant message (read through RLS). */
async function ownAssistantMessage(db: Db, id: string) {
  const { data, error } = await db.from("messages").select("id, role, content").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data || data.role !== "assistant") throw notFound("We couldn't find that message.");
  return data;
}

const unfence = (s: string) => s.trim().replace(/^```(?:mermaid)?\s*\n?/i, "").replace(/\n?```\s*$/, "").trim();

/** One repair attempt with the fast model. Returns null when the reply isn't usable Mermaid. */
export async function repairDiagram(
  deps: { db: Db; model: LanguageModel },
  body: z.infer<typeof repairRequestSchema>,
) {
  const msg = await ownAssistantMessage(deps.db, body.messageId);
  if (!msg.content.includes(body.code.trim())) throw notFound("That diagram isn't in this message.");
  const { text } = await generateText({
    model: deps.model,
    instructions: DIAGRAM_FIXER,
    prompt: `Error: ${body.error}\n\nCode:\n${body.code}`,
    maxOutputTokens: 800,
  });
  const fixed = unfence(text);
  const head = fixed.split(/\s+/)[0] ?? "";
  if (!FORMAT.mermaid.allowed.includes(head as (typeof FORMAT.mermaid.allowed)[number])) return null;
  return fixed;
}

/** Store the repaired code in the message, so it renders without repair next time. */
export async function saveRepair(deps: { db: Db; admin: Db }, body: z.infer<typeof saveRepairSchema>) {
  const msg = await ownAssistantMessage(deps.db, body.messageId);
  const from = body.from.trim();
  if (!msg.content.includes(from)) return false;
  const content = msg.content.replace(from, body.to.trim());
  const { error } = await deps.admin.from("messages").update({ content }).eq("id", msg.id);
  if (error) throw error;
  return true;
}

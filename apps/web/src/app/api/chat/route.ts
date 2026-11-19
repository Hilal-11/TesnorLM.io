import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { z } from "zod";
import { requireUserForApi } from "@/lib/auth";
import { readEnv } from "@/lib/env";
import { badRequest, withErrorHandling } from "@/lib/errors";
import { FULL_CONTEXT_TOKEN_LIMIT, formatContext, retrieve } from "@/lib/retrieval";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const SYSTEM = `You are TensorLM, an expert tutor.
Explain using ONLY the provided sources unless the user asks for outside knowledge.
If outside knowledge is needed, label it clearly as "Background (not from your documents)".
If the sources don't contain the answer, say so.

Formatting rules:
- Cite sources inline like [1], [2].
- Math: LaTeX with $...$ inline and $$...$$ for blocks.
- Diagrams: a fenced \`\`\`mermaid block (flowchart / graph only, keep it small).
- Charts: a fenced \`\`\`chart block with JSON {"type":"line"|"bar","xKey":"...","series":["..."],"data":[...]}.
- Structure: intuition first, then mechanism, then math, then a short worked example.`;

const chatRequest = z.object({
  notebookId: z.uuid(),
  question: z.string().trim().min(1).max(4000),
  level: z.enum(["beginner", "intermediate", "expert"]).default("intermediate"),
});

export const POST = withErrorHandling("/api/chat", async (req: Request) => {
  await requireUserForApi();
  const parsed = chatRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw badRequest("Send a notebook and a question.");
  const { notebookId, question, level } = parsed.data;
  const env = readEnv("ai");
  const supabase = await createClient();

  // Adaptive routing: whole documents for small notebooks, retrieval for big ones (RLS-scoped).
  // A document answers from its published run (ready_run_id), even while it's re-processed.
  const { data: docs } = await supabase
    .from("documents")
    .select("title, markdown, token_count")
    .eq("notebook_id", notebookId)
    .not("ready_run_id", "is", null)
    .is("deleted_at", null);

  const totalTokens = (docs ?? []).reduce((s, d) => s + (d.token_count ?? 0), 0);

  let context: string;
  if (docs && docs.length > 0 && totalTokens <= FULL_CONTEXT_TOKEN_LIMIT) {
    context = docs.map((d, i) => `[${i + 1}] ${d.title}\n${d.markdown}`).join("\n\n=====\n\n");
  } else {
    const chunks = await retrieve(supabase, notebookId, question);
    context = formatContext(chunks);
  }

  const result = streamText({
    model: anthropic(env.LLM_MODEL),
    system: SYSTEM,
    prompt: `Learner level: ${level}\n\nSOURCES:\n${context}\n\nQUESTION: ${question}`,
  });

  return result.toTextStreamResponse();
});

import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { createClient } from "@/lib/supabase/server";
import { FULL_CONTEXT_TOKEN_LIMIT, formatContext, retrieve } from "@/lib/retrieval";

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

export async function POST(req: Request) {
  const { notebookId, question, level = "student" } = await req.json();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Adaptive routing: whole documents for small notebooks, retrieval for big ones
  const { data: docs } = await supabase
    .from("documents")
    .select("title, markdown, token_count")
    .eq("notebook_id", notebookId)
    .eq("status", "ready");

  const totalTokens = (docs ?? []).reduce((s, d) => s + (d.token_count ?? 0), 0);

  let context: string;
  if (docs && docs.length > 0 && totalTokens <= FULL_CONTEXT_TOKEN_LIMIT) {
    context = docs.map((d, i) => `[${i + 1}] ${d.title}\n${d.markdown}`).join("\n\n=====\n\n");
  } else {
    const chunks = await retrieve(supabase, notebookId, question);
    context = formatContext(chunks);
  }

  const result = streamText({
    model: anthropic(process.env.LLM_MODEL ?? "claude-sonnet-5-5"),
    system: SYSTEM,
    prompt: `Learner level: ${level}\n\nSOURCES:\n${context}\n\nQUESTION: ${question}`,
  });

  return result.toTextStreamResponse();
}

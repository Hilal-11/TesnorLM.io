import "server-only";
/**
 * Question rewriting (fast model): a standalone question, 1–3 search queries, the intent and
 * whether it's about a figure. Skipped for a first question without references (saves latency).
 */
import { generateText, type LanguageModel } from "ai";
import { z } from "zod";
import { REWRITER } from "@/prompts/helpers";

export const rewriteSchema = z.object({
  standalone: z.string().min(1).max(1000),
  queries: z.array(z.string().min(1).max(300)).min(1).max(3),
  intent: z.enum([
    "explain",
    "diagram",
    "example",
    "quiz",
    "summarize",
    "compare",
    "define",
    "chitchat",
    "other",
  ]),
  mentions_figure: z.boolean(),
});
export type Rewrite = z.infer<typeof rewriteSchema>;

const REFERENCES =
  /\b(it|its|this|that|these|those|they|them|he|she|above|previous|earlier|again|same|the figure|the table|more)\b/i;
const FIGURE = /\b(fig(ure)?|table|chart|plot|diagram|graph)\b/i;

/** Without history or references, the question already stands alone. */
export function needsRewrite(question: string, hasHistory: boolean) {
  return hasHistory && REFERENCES.test(question);
}

export function plainRewrite(question: string, command: string | null): Rewrite {
  return {
    standalone: question,
    queries: [question.slice(0, 300)],
    intent:
      command === "diagram"
        ? "diagram"
        : command === "example"
          ? "example"
          : command === "summarize"
            ? "summarize"
            : "explain",
    mentions_figure: FIGURE.test(question),
  };
}

function parseJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return JSON.parse(text.slice(start, end + 1));
}

export async function rewriteQuestion(
  model: LanguageModel,
  question: string,
  history: { role: string; text: string }[],
  command: string | null,
  abortSignal?: AbortSignal,
): Promise<Rewrite> {
  if (!needsRewrite(question, history.length > 0)) return plainRewrite(question, command);
  try {
    const transcript = history.map((t) => `${t.role}: ${t.text.slice(0, 1500)}`).join("\n");
    const { text } = await generateText({
      model,
      system: REWRITER,
      prompt: `<conversation>\n${transcript}\n</conversation>\nLatest question: ${question}`,
      maxOutputTokens: 400,
      abortSignal,
    });
    const parsed = rewriteSchema.safeParse(parseJson(text));
    return parsed.success ? parsed.data : plainRewrite(question, command);
  } catch {
    return plainRewrite(question, command); // never block an answer on the rewriter
  }
}

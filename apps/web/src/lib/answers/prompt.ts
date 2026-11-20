/**
 * Builds the model messages for one answer. Order matters for the prompt cache: the fixed rules,
 * then (full-context mode) the sources, then the history and the question. Cache breakpoints sit
 * after the rules and after <sources> in full-context mode (stable prefix); retrieval mode caches
 * only the rules, because its sources change with every question.
 */
import type { ModelMessage, SystemModelMessage } from "ai";
import { SYSTEM_RULES, levelInstruction, modeInstruction, userTurn } from "@/prompts/chat";
import type { AnswerMode, Command, Level } from "./format";

const CACHE = { anthropic: { cacheControl: { type: "ephemeral" as const } } };

export type PromptInput = {
  mode: AnswerMode;
  level: Level;
  command: Command | null;
  contextText: string;
  history: { role: "user" | "assistant"; text: string }[];
  question: string;
  focus: { document: string; page: number; text: string }[];
  continueFrom?: string;
};

/** System instructions (AI SDK v7 `instructions`) and the conversation (`messages`). */
export function buildMessages(input: PromptInput): {
  instructions: SystemModelMessage[];
  messages: ModelMessage[];
} {
  const instructions: SystemModelMessage[] = [
    { role: "system", content: SYSTEM_RULES, providerOptions: CACHE },
    { role: "system", content: `${levelInstruction(input.level)}\n${modeInstruction(input.mode)}` },
  ];
  const messages: ModelMessage[] = [];
  if (input.contextText) {
    messages.push(
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Here are the passages from my sources.\n${input.contextText}`,
            ...(input.mode === "full_context" ? { providerOptions: CACHE } : {}),
          },
        ],
      },
      { role: "assistant", content: "I've read the sources and will cite them by number." },
    );
  }
  // History must start with the person and alternate; the question always comes last.
  const history = [...input.history];
  while (history[0]?.role === "assistant") history.shift();
  for (const turn of history) messages.push({ role: turn.role, content: turn.text });
  if (messages.at(-1)?.role === "user")
    messages.push({ role: "assistant", content: "Understood." });
  messages.push({
    role: "user",
    content: userTurn({
      question: input.question,
      focus: input.focus,
      command: input.command,
      continueFrom: input.continueFrom,
    }),
  });
  return { instructions, messages };
}

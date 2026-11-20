/**
 * The answer-format contract (contracts/answer-format.json): levels, directives, fenced blocks,
 * citations, message states, feedback reasons and slash commands. Prompts, the renderer and the
 * API all read their words and limits from here. Spec: docs/specs/answers.md.
 */
import { z } from "zod";
import { FORMAT } from "./format.generated";

const contractSchema = z.object({
  version: z.literal(1),
  promptVersion: z.string().min(1),
  levels: z.record(z.string(), z.object({ label: z.string().min(1), style: z.string().min(1) })),
  directives: z.record(
    z.string(),
    z.object({ label: z.string().min(1), max: z.number().int().min(1) }),
  ),
  mermaid: z.object({ allowed: z.array(z.string()).min(1), maxNodes: z.number().int().positive() }),
  chart: z.object({
    types: z.array(z.string()).min(1),
    maxSeries: z.number().int().positive(),
    maxPoints: z.number().int().positive(),
  }),
  citations: z.object({
    maxPerSentence: z.number().int().positive(),
    quotePreviewChars: z.number().int().positive(),
  }),
  messageStates: z.array(z.string()).min(1),
  modes: z.array(z.string()).min(1),
  feedbackReasons: z.record(z.string(), z.string().min(1)),
  commands: z.record(
    z.string(),
    z.object({
      label: z.string().min(1),
      description: z.string().min(1),
      template: z.string().min(1),
    }),
  ),
  limits: z.record(z.string(), z.number().int().positive()),
});

/** Validates the contract; throws with every problem (tests call it on broken copies). */
export function validateFormat(raw: unknown) {
  return contractSchema.parse(raw);
}
validateFormat(FORMAT);

export type Level = keyof typeof FORMAT.levels;
export type Directive = keyof typeof FORMAT.directives;
export type Command = keyof typeof FORMAT.commands;
export type FeedbackReason = keyof typeof FORMAT.feedbackReasons;
export type MessageState = (typeof FORMAT.messageStates)[number];
export type AnswerMode = (typeof FORMAT.modes)[number];

export const PROMPT_VERSION = FORMAT.promptVersion;
export const LEVELS = Object.keys(FORMAT.levels) as Level[];
export const COMMANDS = Object.keys(FORMAT.commands) as Command[];
export const FEEDBACK_REASONS = Object.keys(FORMAT.feedbackReasons) as FeedbackReason[];
export const DIRECTIVES = FORMAT.directives;
export const LIMITS = FORMAT.limits;
export const MERMAID = FORMAT.mermaid;
export const CITATIONS = FORMAT.citations;

export const levelSchema = z.enum(LEVELS as [Level, ...Level[]]);
export const commandSchema = z.enum(COMMANDS as [Command, ...Command[]]);
export const feedbackReasonSchema = z.enum(
  FEEDBACK_REASONS as [FeedbackReason, ...FeedbackReason[]],
);

export const levelLabel = (level: Level) => FORMAT.levels[level].label;
export const levelStyle = (level: Level) => FORMAT.levels[level].style;
export const commandTemplate = (command: Command) => FORMAT.commands[command].template;
export const commandLabel = (command: Command) => FORMAT.commands[command].label;
export const feedbackLabel = (reason: FeedbackReason) => FORMAT.feedbackReasons[reason];

/** One level down / up, for "Make simpler" and "Go deeper". */
export function shiftLevel(level: Level, by: -1 | 1): Level {
  const i = LEVELS.indexOf(level);
  return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, i + by))];
}

// ───────────── Chart blocks (```chart) ─────────────

const point = z.record(z.string(), z.union([z.number(), z.string()]));

export const chartSpecSchema = z
  .strictObject({
    type: z.enum(FORMAT.chart.types as unknown as [string, ...string[]]),
    title: z.string().max(120).optional(),
    xKey: z.string().min(1).max(60),
    yLabel: z.string().max(60).optional(),
    xLabel: z.string().max(60).optional(),
    series: z.array(z.string().min(1).max(60)).min(1).max(FORMAT.chart.maxSeries),
    data: z.array(point).min(1).max(FORMAT.chart.maxPoints),
  })
  .refine((spec) => spec.data.every((row) => spec.xKey in row), {
    message: "every data row needs the xKey",
  })
  .refine((spec) => spec.series.every((s) => spec.data.some((row) => typeof row[s] === "number")), {
    message: "every series needs numeric values",
  });
export type ChartSpec = z.infer<typeof chartSpecSchema>;

/** Parses a ```chart block; null when it isn't a valid spec (the renderer shows a quiet note). */
export function parseChartSpec(text: string): ChartSpec | null {
  try {
    const parsed = chartSpecSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

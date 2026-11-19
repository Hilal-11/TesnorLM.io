/**
 * The ingestion contract shared with the Python worker: stage names, allowed transitions, learner
 * words, detail lines, error copy, events, limits and storage paths.
 *
 * Source of truth: contracts/ingestion.json (spec: docs/specs/ingestion.md). The worker loads the
 * same file in services/worker/app/contract.py, and contracts/fixtures/ingestion-cases.json proves
 * both give identical answers. Never hard-code a stage name, error code or their copy elsewhere.
 */
import { z } from "zod";
import { CONTRACT } from "./contract.generated";

type Contract = typeof CONTRACT;
export type Stage = Contract["stages"][number];
export type UiWord = Contract["uiWords"][Stage];
export type ErrorCode = keyof Contract["errors"];
export type ActionId = keyof Contract["actions"];
export type StoragePathKind = keyof Contract["storage"]["paths"];

/** Template values: strings, or whole numbers (safe integers). Anything else counts as missing. */
export type TemplateVars = Readonly<Record<string, unknown>>;

export interface ErrorCopy {
  code: ErrorCode;
  message: string;
  fix: string;
  actions: { id: ActionId; label: string }[];
  /** Whether the queue retries the failed step on its own (false = only the person can retry). */
  autoRetry: boolean;
}

// ───────────── Templates ─────────────

// `{name}` inserts a value; `{name:one|other}` picks a word by count ("1 page", "2 pages").
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)(?::([^{}|]*)\|([^{}]*))?\}/g;
const STORAGE_VARS = new Set(["userId", "documentId", "runId", "n"]);

function placeholderNames(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

function hasStrayBraces(template: string): boolean {
  return /[{}]/.test(template.replace(PLACEHOLDER, ""));
}

function renderValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  return undefined;
}

/** Fills every placeholder, or returns undefined when any value is missing or unusable. */
function fill(template: string, vars: TemplateVars): string | undefined {
  let missing = false;
  const out = template.replace(PLACEHOLDER, (_, name: string, one?: string, other?: string) => {
    const value = Object.hasOwn(vars, name) ? renderValue(vars[name]) : undefined;
    if (value === undefined) {
      missing = true;
      return "";
    }
    if (one === undefined) return value;
    return value === "1" ? one : (other ?? "");
  });
  return missing ? undefined : out;
}

// ───────────── Validation ─────────────

const Name = z.string().regex(/^[a-z][a-z_]*$/);
const EventName = z.string().regex(/^[a-z]+\/[a-z-]+$/);
const Count = z.int().positive();

const TemplateDef = z.strictObject({
  template: z.string().min(1),
  fallback: z.string().min(1).optional(),
  vars: z.array(z.string()).optional(),
});

const ErrorDef = z.strictObject({
  message: z.string().min(1),
  fallback: z.string().min(1).optional(),
  fix: z.string().min(1),
  vars: z.array(z.string()).optional(),
  actions: z.array(z.string()).optional(),
  autoRetry: z.boolean(),
});

const ContractSchema = z.strictObject({
  version: z.literal(1),
  stages: z.array(Name).min(2),
  transitions: z.record(z.string(), z.array(z.string())),
  uiWords: z.record(z.string(), z.string().min(1)),
  details: z.record(z.string(), TemplateDef),
  actions: z.record(Name, z.string().min(1)),
  errors: z.record(Name, ErrorDef),
  events: z.strictObject({
    uploaded: EventName,
    reprocess: EventName,
    deleted: EventName,
    notebookDeleted: EventName,
  }),
  limits: z.strictObject({
    maxUploadMb: Count,
    maxPages: Count,
    maxFilesPerBatch: Count,
    maxParallelUploads: Count,
    maxSourcesFree: Count,
  }),
  storage: z.strictObject({
    bucket: z.string().min(1),
    artifactsBucket: z.string().min(1),
    paths: z.strictObject({ source: z.string(), figure: z.string(), parsed: z.string() }),
  }),
});

function sameKeys(where: string, actual: Iterable<string>, expected: Iterable<string>): string[] {
  const a = new Set(actual);
  const e = new Set(expected);
  return [
    ...[...e].filter((k) => !a.has(k)).map((k) => `${where}: missing "${k}"`),
    ...[...a].filter((k) => !e.has(k)).map((k) => `${where}: unknown "${k}"`),
  ];
}

function templateProblems(
  where: string,
  template: string,
  vars: readonly string[] = [],
  fallback?: string,
): string[] {
  const problems: string[] = [];
  if (hasStrayBraces(template)) problems.push(`${where}: unmatched { or }`);
  if (new Set(vars).size !== vars.length) problems.push(`${where}: repeated vars`);
  problems.push(...sameKeys(`${where} placeholders`, placeholderNames(template), vars));
  if (vars.length > 0 && fallback === undefined) problems.push(`${where}: vars need a fallback`);
  if (vars.length === 0 && fallback !== undefined) problems.push(`${where}: fallback without vars`);
  if (fallback !== undefined && /[{}]/.test(fallback)) {
    problems.push(`${where}: fallback can't use placeholders`);
  }
  return problems;
}

/** Every reason the contract is invalid (empty when valid). Same rules as the worker's. */
export function validateContract(raw: unknown): string[] {
  const parsed = ContractSchema.safeParse(raw);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => `${i.path.join(".") || "contract"}: ${i.message}`);
  }
  const c = parsed.data;
  const stages = new Set(c.stages);
  const problems: string[] = [];

  if (stages.size !== c.stages.length) problems.push("stages: repeated stage");
  for (const required of ["ready", "failed"]) {
    if (!stages.has(required)) problems.push(`stages: missing "${required}"`);
  }

  problems.push(...sameKeys("transitions", Object.keys(c.transitions), stages));
  for (const [from, targets] of Object.entries(c.transitions)) {
    for (const to of targets) {
      if (!stages.has(to)) problems.push(`transitions.${from}: unknown stage "${to}"`);
      if (to === from) problems.push(`transitions.${from}: can't move to itself`);
    }
    if (new Set(targets).size !== targets.length) problems.push(`transitions.${from}: repeated`);
    const terminal = from === "ready" || from === "failed";
    if (terminal && targets.length > 0) problems.push(`transitions.${from}: must be terminal`);
    if (!terminal && !targets.includes("failed")) {
      problems.push(`transitions.${from}: must be able to fail`);
    }
  }

  problems.push(...sameKeys("uiWords", Object.keys(c.uiWords), stages));

  const detailed = c.stages.filter((s) => s !== "failed");
  problems.push(...sameKeys("details", Object.keys(c.details), detailed));
  for (const [stage, d] of Object.entries(c.details)) {
    problems.push(...templateProblems(`details.${stage}`, d.template, d.vars, d.fallback));
  }

  if (!("internal" in c.errors)) problems.push('errors: missing "internal"');
  for (const [code, e] of Object.entries(c.errors)) {
    problems.push(...templateProblems(`errors.${code}`, e.message, e.vars, e.fallback));
    if (/[{}]/.test(e.fix)) problems.push(`errors.${code}: fix can't use placeholders`);
    for (const id of e.actions ?? []) {
      if (!(id in c.actions)) problems.push(`errors.${code}: unknown action "${id}"`);
    }
  }

  for (const [kind, path] of Object.entries(c.storage.paths)) {
    const where = `storage.paths.${kind}`;
    if (hasStrayBraces(path) || /:/.test(path)) problems.push(`${where}: bad placeholder`);
    for (const name of placeholderNames(path)) {
      if (!STORAGE_VARS.has(name)) problems.push(`${where}: unknown placeholder "${name}"`);
    }
    // Storage RLS allows a user only inside their own first folder.
    if (!path.startsWith("{userId}/")) problems.push(`${where}: must start with {userId}/`);
  }
  return problems;
}

const problems = validateContract(CONTRACT);
if (problems.length > 0) {
  throw new Error(`contracts/ingestion.json is invalid:\n- ${problems.join("\n- ")}`);
}

// ───────────── API ─────────────

const TRANSITIONS: Readonly<Record<string, readonly string[]>> = CONTRACT.transitions;
const DETAILS: Readonly<
  Record<string, { template: string; fallback?: string; vars?: readonly string[] }>
> = CONTRACT.details;
const ERRORS: Readonly<
  Record<
    string,
    {
      message: string;
      fallback?: string;
      fix: string;
      actions?: readonly string[];
      autoRetry: boolean;
    }
  >
> = CONTRACT.errors;
const ACTIONS: Readonly<Record<string, string>> = CONTRACT.actions;

export const CONTRACT_VERSION = CONTRACT.version;
export const STAGES: readonly Stage[] = CONTRACT.stages;
export const EVENTS = CONTRACT.events;
/** Defaults only: server code reads MAX_UPLOAD_MB, MAX_PAGES and MAX_SOURCES_FREE from env. */
export const LIMITS = CONTRACT.limits;
export const STORAGE = CONTRACT.storage;

export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && Object.hasOwn(TRANSITIONS, value);
}

function assertStage(stage: string): asserts stage is Stage {
  if (!isStage(stage)) throw new Error(`Unknown ingestion stage "${stage}"`);
}

/** The learner word for a stage: Uploading, Queued, Reading, Indexing, Ready or Failed. */
export function uiWord(stage: Stage): UiWord {
  assertStage(stage);
  return CONTRACT.uiWords[stage];
}

/** Whether a run may move from one stage to another. Staying in a stage is a progress update. */
export function canTransition(from: string, to: string): boolean {
  return isStage(from) && isStage(to) && TRANSITIONS[from].includes(to);
}

/** Ready and Failed end a run; a re-process starts a new run. */
export function isTerminal(stage: Stage): boolean {
  assertStage(stage);
  return TRANSITIONS[stage].length === 0;
}

/** The status line under a source ("Reading page 18 of 42"). Failed has none: use errorCopy. */
export function detailLine(stage: Stage, vars: TemplateVars = {}): string {
  assertStage(stage);
  const detail = DETAILS[stage];
  if (!detail) throw new Error(`Stage "${stage}" has no detail line; use errorCopy()`);
  return fill(detail.template, vars) ?? detail.fallback ?? detail.template;
}

/** Reason + fix for an error code. Unknown or empty codes get the "internal" copy. */
export function errorCopy(code: string | null | undefined, vars: TemplateVars = {}): ErrorCopy {
  const known = code != null && Object.hasOwn(ERRORS, code) ? code : "internal";
  const def = ERRORS[known];
  return {
    code: known as ErrorCode,
    message: fill(def.message, vars) ?? def.fallback ?? def.message,
    fix: def.fix,
    actions: (def.actions ?? []).map((id) => ({ id: id as ActionId, label: ACTIONS[id] })),
    autoRetry: def.autoRetry,
  };
}

const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

/**
 * A storage object path. Throws when a value is missing or isn't a plain path segment (ids and
 * numbers only), so a path can never be guessed or escape the user's folder.
 */
export function storagePath(kind: StoragePathKind, vars: TemplateVars): string {
  return STORAGE.paths[kind].replace(PLACEHOLDER, (_, name: string) => {
    const value = Object.hasOwn(vars, name) ? renderValue(vars[name]) : undefined;
    if (value === undefined || !SAFE_SEGMENT.test(value)) {
      throw new Error(`storagePath("${kind}"): "${name}" is missing or not a plain path segment`);
    }
    return value;
  });
}

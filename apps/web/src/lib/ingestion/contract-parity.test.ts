// Writes contracts/fixtures/ingestion-cases.json: a table of inputs and the answers this module
// gives. services/worker/tests/test_contract.py asserts the Python contract gives the same answers,
// so the two languages can't drift. After changing the contract or its helpers, run
// `npm test -- -u` here, then the worker's pytest.
import { describe, expect, it } from "vitest";
import {
  STAGES,
  canTransition,
  detailLine,
  errorCopy,
  isTerminal,
  noticeCopy,
  sourceTypeFromName,
  storagePath,
  uiWord,
  type Stage,
  type StoragePathKind,
} from "./contract";
import { CONTRACT } from "./contract.generated";

const FIXTURE = "../../../../../contracts/fixtures/ingestion-cases.json";

type Vars = Record<string, unknown>;

function run(fn: () => unknown): { out: unknown } | { throws: true } {
  try {
    return { out: fn() };
  } catch {
    return { throws: true };
  }
}

const SAMPLE: Vars = {
  percent: 62,
  page: 4,
  pages: 12,
  done: 3,
  total: 9,
  passages: 128,
  sizeMb: "63.4",
  limitMb: 50,
  limit: 200,
  minutes: 15,
  count: 3,
};
// Must count as missing in both languages (2 ** 53 is past the safe-integer range).
const UNUSABLE: unknown[] = [62.5, true, null, { n: 1 }, [1], 2 ** 53, -(2 ** 53)];

/** Inputs for a template: none, all, each var singular, a placeholder-looking value, unusables. */
function variants(vars: readonly string[]): Vars[] {
  const full = Object.fromEntries(vars.map((v) => [v, SAMPLE[v]]));
  const out: Vars[] = [{}, full, { ...full, unrelated: "ignored" }];
  for (const v of vars) {
    out.push({ ...full, [v]: 1 }, { ...full, [v]: "{page}" }, { ...full, [v]: -0 });
  }
  if (vars.length > 0) for (const bad of UNUSABLE) out.push({ ...full, [vars[0]]: bad });
  return out;
}

const details: Readonly<Record<string, { template: string; vars?: readonly string[] }>> =
  CONTRACT.details;
const askableDetails: Readonly<Record<string, { template: string; vars?: readonly string[] }>> =
  CONTRACT.askable.details;
const errors: Readonly<Record<string, { message: string; vars?: readonly string[] }>> =
  CONTRACT.errors;
const notices: Readonly<Record<string, { message: string; vars?: readonly string[] }>> =
  CONTRACT.notices;

const FILENAMES = [
  "attention.pdf",
  "Attention.PDF",
  "deck.final.pptx",
  "C:\\Users\\me\\notes.md",
  "folder/data.TSV",
  "photo.HEIC",
  ".pdf",
  "README",
  "archive.tar.gz",
  "slides.ppt",
  "trailing.",
  "dir.pdf/file",
];

function buildCases() {
  const stages: string[] = [...STAGES, "nope"];
  const ids = { userId: "6f1c2a9e-0b7d-4c1e-9a52-3d8e4f7b1c20", documentId: "d-1", runId: "r-1" };

  return {
    version: CONTRACT.version,
    uiWord: stages.flatMap((stage) =>
      [false, true].map((askable) => ({
        stage,
        askable,
        ...run(() => uiWord(stage as Stage, { askable })),
      })),
    ),
    canTransition: stages.flatMap((from) =>
      stages.map((to) => ({ from, to, out: canTransition(from, to) })),
    ),
    isTerminal: stages.map((stage) => ({ stage, ...run(() => isTerminal(stage as Stage)) })),
    detailLine: stages.flatMap((stage) => [
      ...variants(details[stage]?.vars ?? []).map((vars) => ({
        stage,
        vars,
        askable: false,
        ...run(() => detailLine(stage as Stage, vars)),
      })),
      ...variants(askableDetails[stage]?.vars ?? details[stage]?.vars ?? []).map((vars) => ({
        stage,
        vars,
        askable: true,
        ...run(() => detailLine(stage as Stage, vars, { askable: true })),
      })),
    ]),
    errorCopy: [...Object.keys(CONTRACT.errors), "nope", null].flatMap((code) =>
      variants((code && errors[code]?.vars) || []).map((vars) => ({
        code,
        vars,
        out: errorCopy(code, vars),
      })),
    ),
    noticeCopy: [...Object.keys(CONTRACT.notices), "nope", null].flatMap((code) =>
      variants((code && notices[code]?.vars) || []).map((vars) => ({
        code,
        vars,
        out: noticeCopy(code, vars),
      })),
    ),
    sourceTypeFromName: FILENAMES.map((name) => ({ name, out: sourceTypeFromName(name) })),
    storagePath: (Object.keys(CONTRACT.storage.paths) as StoragePathKind[]).flatMap((kind) =>
      [
        { ...ids, n: 3 },
        { ...ids, n: "3" },
        { ...ids, n: 3.5 },
        { userId: ids.userId },
        { ...ids, n: 3, documentId: "../d-2" },
        { ...ids, n: 3, runId: "r-1\n" },
      ].map((vars) => ({ kind, vars, ...run(() => storagePath(kind, vars)) })),
    ),
  };
}

describe("contract parity fixture", () => {
  it("matches contracts/fixtures/ingestion-cases.json (pytest checks the worker against it)", async () => {
    await expect(`${JSON.stringify(buildCases(), null, 2)}\n`).toMatchFileSnapshot(FIXTURE);
  });
});

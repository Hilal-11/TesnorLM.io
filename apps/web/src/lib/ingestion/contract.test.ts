import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EVENTS,
  STAGES,
  canTransition,
  detailLine,
  errorCopy,
  isStage,
  isTerminal,
  storagePath,
  uiWord,
  validateContract,
  type Stage,
} from "./contract";
import { CONTRACT } from "./contract.generated";

const SOURCE = new URL("../../../../../contracts/ingestion.json", import.meta.url);
const source = JSON.parse(readFileSync(SOURCE, "utf8"));
const clone = () => structuredClone(source);

describe("ingestion contract", () => {
  it("generated copy matches contracts/ingestion.json (else run npm run contract:sync)", () => {
    expect(CONTRACT).toEqual(source);
  });

  it("is valid", () => {
    expect(validateContract(source)).toEqual([]);
  });

  it("gives every stage a learner word from the design skill's vocabulary", () => {
    const words = new Set(STAGES.map((stage) => uiWord(stage)));
    expect([...words].sort()).toEqual(
      ["Failed", "Indexing", "Queued", "Reading", "Ready", "Uploading"].sort(),
    );
  });

  it("only moves to known stages, and every unfinished stage can fail", () => {
    for (const from of STAGES) {
      for (const to of CONTRACT.transitions[from]) expect(isStage(to)).toBe(true);
      if (!isTerminal(from)) expect(canTransition(from, "failed")).toBe(true);
    }
  });

  it("gives every error a message and a fix", () => {
    for (const code of Object.keys(CONTRACT.errors)) {
      const copy = errorCopy(code);
      expect(copy.code).toBe(code);
      expect(copy.message.length).toBeGreaterThan(0);
      expect(copy.fix.length).toBeGreaterThan(0);
    }
  });

  it("keeps banned words out of the copy (design skill section 9)", () => {
    const copy = JSON.stringify([CONTRACT.uiWords, CONTRACT.details, CONTRACT.errors]);
    expect(copy).not.toMatch(/something went wrong|oops|seamless|magic|effortless|sorry/i);
  });

  it("names the four queue events", () => {
    expect(EVENTS).toEqual({
      uploaded: "document/uploaded",
      reprocess: "document/reprocess",
      deleted: "document/deleted",
      notebookDeleted: "notebook/deleted",
    });
  });
});

describe("validateContract rejects", () => {
  it.each([
    ["a stage without a learner word", (c) => delete c.uiWords.ocr, 'uiWords: missing "ocr"'],
    [
      "a transition to an unknown stage",
      (c) => c.transitions.parsing.push("summarising"),
      'transitions.parsing: unknown stage "summarising"',
    ],
    ["an error without a fix", (c) => delete c.errors.not_pdf.fix, "errors.not_pdf.fix"],
    [
      "a placeholder that isn't declared",
      (c) => (c.errors.corrupt_pdf.message = "Page {page} is damaged."),
      'errors.corrupt_pdf placeholders: unknown "page"',
    ],
    [
      "vars without a fallback",
      (c) => delete c.errors.file_too_large.fallback,
      "errors.file_too_large: vars need a fallback",
    ],
    [
      "an unknown action",
      (c) => (c.errors.internal.actions = ["call_support"]),
      'errors.internal: unknown action "call_support"',
    ],
    ["no internal error", (c) => delete c.errors.internal, 'errors: missing "internal"'],
    [
      "a terminal stage with transitions",
      (c) => (c.transitions.ready = ["queued"]),
      "transitions.ready: must be terminal",
    ],
    [
      "a stage that can't fail",
      (c) => (c.transitions.indexing = ["ready"]),
      "transitions.indexing: must be able to fail",
    ],
    [
      "a storage path outside the user's folder",
      (c) => (c.storage.paths.source = "{documentId}/source.pdf"),
      "storage.paths.source: must start with {userId}/",
    ],
    [
      "unmatched braces",
      (c) => (c.details.queued.template = "Waiting {"),
      "details.queued: unmatched",
    ],
    ["an unknown top-level key", (c) => (c.extra = 1), "extra"],
  ] as [string, (c: typeof source) => unknown, string][])("%s", (_, mutate, problem) => {
    const contract = clone();
    mutate(contract);
    expect(validateContract(contract)).toEqual(
      expect.arrayContaining([expect.stringContaining(problem)]),
    );
  });
});

describe("contract helpers", () => {
  it("maps stages to learner words", () => {
    expect(uiWord("ocr")).toBe("Reading");
    expect(uiWord("reading_figures")).toBe("Reading");
    expect(() => uiWord("summarising" as Stage)).toThrow(/Unknown ingestion stage/);
  });

  it("allows only forward moves within a run", () => {
    expect(canTransition("parsing", "ocr")).toBe(true);
    expect(canTransition("parsing", "indexing")).toBe(true); // no figures to read
    expect(canTransition("indexing", "parsing")).toBe(false);
    expect(canTransition("ready", "queued")).toBe(false); // a re-process is a new run
    expect(canTransition("parsing", "parsing")).toBe(false); // progress, not a move
    expect(canTransition("nope", "failed")).toBe(false);
  });

  it("writes honest detail lines, with plurals", () => {
    expect(detailLine("parsing", { page: 18, pages: 42 })).toBe("Reading page 18 of 42");
    expect(detailLine("ocr", { page: 4, pages: 12 })).toBe("Running OCR on page 4 of 12");
    expect(detailLine("uploading", { percent: 62 })).toBe("Uploading · 62%");
    expect(detailLine("ready", { pages: 42 })).toBe("42 pages · Ready");
    expect(detailLine("ready", { pages: 1 })).toBe("1 page · Ready");
    expect(detailLine("indexing", { passages: 1 })).toBe("Indexing 1 passage");
  });

  it("falls back to a line without numbers when a value is missing or unusable", () => {
    expect(detailLine("parsing", { page: 18 })).toBe("Reading the pages");
    expect(detailLine("uploading", { percent: 62.5 })).toBe("Uploading");
    expect(detailLine("ready", { pages: true })).toBe("Ready");
    expect(detailLine("queued")).toBe("Waiting to start");
    expect(() => detailLine("failed")).toThrow(/errorCopy/);
  });

  it("gives an error's reason and fix in the skill's words", () => {
    const copy = errorCopy("file_too_large", { sizeMb: "120", limitMb: 50 });
    expect(`${copy.message} ${copy.fix}`).toBe(
      "This file is 120 MB. The limit is 50 MB. Split the PDF or upload chapters separately.",
    );
    expect(copy.autoRetry).toBe(false);
    expect(errorCopy("file_too_large").message).toBe("This file is over the size limit.");
  });

  it("names the actions an error offers", () => {
    expect(errorCopy("duplicate_file").actions).toEqual([
      { id: "open_existing", label: "Open it" },
      { id: "add_anyway", label: "Add anyway" },
    ]);
    expect(errorCopy("not_pdf").actions).toEqual([]);
  });

  it("treats unknown codes as internal and only retries internal on its own", () => {
    expect(errorCopy("made_up").code).toBe("internal");
    expect(errorCopy(null).code).toBe("internal");
    const retried = Object.keys(CONTRACT.errors).filter((code) => errorCopy(code).autoRetry);
    expect(retried).toEqual(["internal"]);
  });

  it("never re-reads placeholders inside values", () => {
    expect(errorCopy("file_too_large", { sizeMb: "{limitMb}", limitMb: 50 }).message).toBe(
      "This file is {limitMb} MB. The limit is 50 MB.",
    );
  });

  it("builds storage paths inside the user's folder only", () => {
    const ids = { userId: "u-1", documentId: "d-1", runId: "r-1", n: 3 };
    expect(storagePath("source", ids)).toBe("u-1/d-1/source.pdf");
    expect(storagePath("figure", ids)).toBe("u-1/d-1/figures/r-1/3.webp");
    expect(storagePath("parsed", ids)).toBe("u-1/d-1/r-1/doc.json");
    expect(() => storagePath("source", { userId: "u-1" })).toThrow(/documentId/);
    expect(() => storagePath("source", { ...ids, documentId: "../d-2" })).toThrow(/documentId/);
  });
});

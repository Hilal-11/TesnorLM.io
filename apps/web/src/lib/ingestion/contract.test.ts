import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Constants } from "@/lib/database.types";
import {
  EVENTS,
  STAGES,
  canTransition,
  detailLine,
  errorCopy,
  isStage,
  isTerminal,
  noticeCopy,
  sourceTypeFromName,
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

  it("matches the database's document_stage enum (migrations 0004 + 0006)", () => {
    expect([...Constants.public.Enums.document_stage]).toEqual([...STAGES]);
  });

  it("gives every stage a learner word (v2 vocabulary)", () => {
    const words = new Set(STAGES.map((stage) => uiWord(stage)));
    expect([...words].sort()).toEqual(
      [
        "Couldn't read",
        "Improving",
        "Indexing",
        "Needs password",
        "Queued",
        "Reading",
        "Reading figures",
        "Ready",
        "Ready to ask",
        "Repairing file",
        "Running OCR",
        "Uploading",
      ].sort(),
    );
  });

  it("never rejects a PDF at upload: the v1 rejection codes are gone", () => {
    for (const code of ["not_pdf", "encrypted_pdf", "corrupt_pdf", "too_many_pages"]) {
      expect(code in CONTRACT.errors).toBe(false);
    }
  });

  it("gives every notice a message", () => {
    for (const code of Object.keys(CONTRACT.notices)) {
      expect(noticeCopy(code)?.message.length).toBeGreaterThan(0);
    }
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
    const copy = JSON.stringify([
      CONTRACT.uiWords,
      CONTRACT.details,
      CONTRACT.askable,
      CONTRACT.errors,
      CONTRACT.notices,
    ]);
    expect(copy).not.toMatch(/something went wrong|oops|seamless|magic|effortless|sorry/i);
  });

  it("names the queue events", () => {
    expect(EVENTS).toEqual({
      uploaded: "document/uploaded",
      reprocess: "document/reprocess",
      deleted: "document/deleted",
      notebookDeleted: "notebook/deleted",
      fastReady: "document/fast-ready",
      passwordProvided: "document/password-provided",
      sourcesChanged: "notebook/sources-changed",
    });
  });
});

describe("validateContract rejects", () => {
  it.each([
    ["a stage without a learner word", (c) => delete c.uiWords.ocr, 'uiWords: missing "ocr"'],
    [
      "a transition to an unknown stage",
      (c) => c.transitions.parsing_deep.push("summarising"),
      'transitions.parsing_deep: unknown stage "summarising"',
    ],
    [
      "an error without a fix",
      (c) => delete c.errors.unsupported_type.fix,
      "errors.unsupported_type.fix",
    ],
    [
      "a placeholder that isn't declared",
      (c) => (c.errors.unreadable_after_repair.message = "Page {page} is damaged."),
      'errors.unreadable_after_repair placeholders: unknown "page"',
    ],
    [
      "a notice placeholder that isn't declared",
      (c) => (c.notices.repaired.message = "Repaired {count} pages."),
      'notices.repaired placeholders: unknown "count"',
    ],
    [
      "an askable line for a finished stage",
      (c) => (c.askable.details.ready = { template: "Ready" }),
      "askable.details.ready: not a working stage",
    ],
    [
      "an extension claimed by two types",
      (c) => c.sourceTypes.markdown.extensions.push(".txt"),
      'sourceTypes.markdown: ".txt" is already text',
    ],
    [
      "a file type without extensions",
      (c) => (c.sourceTypes.docx.extensions = []),
      "sourceTypes.docx: a file type needs extensions",
    ],
    [
      "a link type with extensions",
      (c) => (c.sourceTypes.web.extensions = [".url"]),
      "sourceTypes.web: only file types have extensions",
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
    expect(uiWord("ocr")).toBe("Running OCR");
    expect(uiWord("parsing_fast")).toBe("Reading");
    expect(uiWord("fast_ready")).toBe("Ready to ask");
    expect(uiWord("failed")).toBe("Couldn't read");
    expect(() => uiWord("summarising" as Stage)).toThrow(/Unknown ingestion stage/);
  });

  it("says Ready to ask while a later stage improves an askable source", () => {
    expect(uiWord("parsing_deep", { askable: true })).toBe("Ready to ask");
    expect(uiWord("indexing", { askable: true })).toBe("Ready to ask");
    expect(uiWord("parsing_deep")).toBe("Improving");
    expect(uiWord("validating", { askable: true })).toBe("Reading"); // nothing askable yet
    expect(detailLine("parsing_deep", { page: 3, pages: 30 }, { askable: true })).toBe(
      "Ready to ask · improving page 3 of 30",
    );
    expect(detailLine("reading_figures", { done: 2, total: 8 }, { askable: true })).toBe(
      "Ready to ask · reading figures 2 of 8",
    );
    expect(detailLine("indexing", { passages: 80 }, { askable: true })).toBe(
      "Ready to ask · improving tables and figures",
    );
    expect(detailLine("queued", {}, { askable: true })).toBe("Waiting to start");
  });

  it("allows the v2 paths: password, repair, fast then deep pass, scans", () => {
    expect(canTransition("validating", "needs_password")).toBe(true);
    expect(canTransition("needs_password", "validating")).toBe(true); // after the password
    expect(canTransition("validating", "repairing")).toBe(true);
    expect(canTransition("repairing", "ocr")).toBe(true); // rendered pages, read as a scan
    expect(canTransition("parsing_fast", "fast_ready")).toBe(true);
    expect(canTransition("fast_ready", "parsing_deep")).toBe(true);
    expect(canTransition("fast_ready", "ready")).toBe(true); // text formats: nothing to improve
    expect(canTransition("validating", "ocr")).toBe(true); // scans skip the fast pass
    expect(canTransition("parsing_deep", "indexing")).toBe(true); // no figures to read
  });

  it("refuses moves the contract doesn't list", () => {
    expect(canTransition("indexing", "parsing_deep")).toBe(false);
    expect(canTransition("ready", "queued")).toBe(false); // a re-process is a new run
    expect(canTransition("parsing_deep", "parsing_deep")).toBe(false); // progress, not a move
    expect(canTransition("parsing_fast", "parsing_deep")).toBe(false); // publish the fast run first
    expect(canTransition("needs_password", "parsing_fast")).toBe(false); // re-check after unlocking
    expect(canTransition("nope", "failed")).toBe(false);
  });

  it("writes honest detail lines, with plurals", () => {
    expect(detailLine("parsing_fast", { page: 18, pages: 42 })).toBe("Reading page 18 of 42");
    expect(detailLine("ocr", { page: 4, pages: 12 })).toBe("Running OCR on page 4 of 12");
    expect(detailLine("uploading", { percent: 62 })).toBe("Uploading · 62%");
    expect(detailLine("ready", { pages: 42 })).toBe("42 pages · Ready");
    expect(detailLine("ready", { pages: 1 })).toBe("1 page · Ready");
    expect(detailLine("indexing", { passages: 1 })).toBe("Indexing 1 passage");
  });

  it("falls back to a line without numbers when a value is missing or unusable", () => {
    expect(detailLine("parsing_fast", { page: 18 })).toBe("Reading the text");
    expect(detailLine("uploading", { percent: 62.5 })).toBe("Uploading");
    expect(detailLine("ready", { pages: true })).toBe("Ready");
    expect(detailLine("queued")).toBe("Waiting to start");
    expect(() => detailLine("failed")).toThrow(/errorCopy/);
  });

  it("gives an error's reason and fix in the skill's words", () => {
    const copy = errorCopy("file_too_large", { sizeMb: "120", limitMb: 50 });
    expect(`${copy.message} ${copy.fix}`).toBe(
      "This file is 120 MB. Your plan allows 50 MB per file. Split it, or upgrade for larger files.",
    );
    expect(copy.autoRetry).toBe(false);
    expect(copy.actions).toEqual([{ id: "upgrade", label: "See plans" }]);
    expect(errorCopy("file_too_large").message).toBe("This file is over your plan's size limit.");
  });

  it("writes notices for sources that are usable but partial", () => {
    expect(noticeCopy("pages_capped", { limit: 2000, pages: 2400 })).toEqual({
      code: "pages_capped",
      message: "TensorLM read the first 2000 of 2400 pages.",
      fix: "Split the file to read the rest.",
    });
    expect(noticeCopy("pages_skipped", { count: 1 })?.message).toBe("1 page couldn't be read.");
    expect(noticeCopy("repaired")?.fix).toBeNull();
    expect(noticeCopy("made_up")).toBeNull();
  });

  it("guesses a source type from the file name (the worker sniffs the bytes)", () => {
    expect(sourceTypeFromName("Attention.PDF")).toBe("pdf");
    expect(sourceTypeFromName("deck.final.pptx")).toBe("pptx");
    expect(sourceTypeFromName("folder/data.TSV")).toBe("csv");
    expect(sourceTypeFromName("README")).toBeNull();
    expect(sourceTypeFromName("slides.ppt")).toBeNull(); // uploaded anyway; worker explains
  });

  it("names the actions an error offers", () => {
    expect(errorCopy("duplicate_file").actions).toEqual([
      { id: "open_existing", label: "Open it" },
      { id: "add_anyway", label: "Add anyway" },
    ]);
    expect(errorCopy("quota_exceeded").actions).toEqual([]);
  });

  it("treats unknown codes as internal and only retries internal on its own", () => {
    expect(errorCopy("made_up").code).toBe("internal");
    expect(errorCopy(null).code).toBe("internal");
    const retried = Object.keys(CONTRACT.errors).filter((code) => errorCopy(code).autoRetry);
    expect(retried).toEqual(["internal"]);
  });

  it("never re-reads placeholders inside values", () => {
    expect(errorCopy("file_too_large", { sizeMb: "{limitMb}", limitMb: 50 }).message).toBe(
      "This file is {limitMb} MB. Your plan allows 50 MB per file.",
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

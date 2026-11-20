import { describe, expect, it } from "vitest";
import {
  applyChange,
  applySnapshot,
  backgroundTitle,
  formatDuration,
  mergeSource,
  sourceStatus,
  stageTimeline,
} from "./live";
import { middleTruncate, type Source } from "./shared";

const base: Source = {
  id: "d1",
  notebook_id: "n1",
  user_id: "u1",
  title: "attention.pdf",
  original_filename: "attention.pdf",
  file_size: 1000,
  page_count: null,
  stage: "parsing_fast",
  progress: 20,
  stage_detail: "Reading page 4 of 12",
  error_code: null,
  error_vars: null,
  ingest_run_id: "run-1",
  ready_run_id: null,
  attempt: 0,
  ocr_used: false,
  figure_count: 0,
  chunk_count: 0,
  stage_timings: {},
  started_at: null,
  finished_at: null,
  created_at: "2026-11-20T10:00:00Z",
  updated_at: "2026-11-20T10:00:01Z",
  deleted_at: null,
  included: true,
};
const row = (over: Partial<Source>): Source => ({ ...base, ...over });

describe("live merge rules", () => {
  it("ignores updates from an older run", () => {
    const current = row({ attempt: 2, ingest_run_id: "run-3", stage: "queued", progress: 0 });
    expect(
      mergeSource(current, row({ attempt: 1, ingest_run_id: "run-2", stage: "indexing" })),
    ).toBe(current);
  });

  it("takes a newer run, even if it starts at queued", () => {
    const current = row({ stage: "ready", progress: 100 });
    const next = row({ attempt: 1, ingest_run_id: "run-2", stage: "queued", progress: 0 });
    expect(mergeSource(current, next)).toBe(next);
  });

  it("never moves backwards within a run", () => {
    const current = row({ stage: "indexing", progress: 70 });
    expect(mergeSource(current, row({ stage: "parsing_deep", progress: 30 })).stage).toBe(
      "indexing",
    );
    const late = mergeSource(row({ progress: 40 }), row({ progress: 25 }));
    expect(late.progress).toBe(40);
    expect(
      mergeSource(row({ stage: "ready", progress: 100 }), row({ stage: "indexing" })).stage,
    ).toBe("ready");
  });

  it("removes deleted rows and keeps creation order", () => {
    let list = applyChange([], {
      type: "upsert",
      row: row({ id: "b", created_at: "2026-11-20T11:00:00Z" }),
    });
    list = applyChange(list, { type: "upsert", row: row({ id: "a" }) });
    expect(list.map((s) => s.id)).toEqual(["a", "b"]);
    list = applyChange(list, {
      type: "upsert",
      row: row({ id: "a", deleted_at: "2026-11-20T12:00:00Z" }),
    });
    expect(list.map((s) => s.id)).toEqual(["b"]);
    expect(applyChange(list, { type: "delete", id: "b" })).toEqual([]);
  });

  it("polling snapshots follow the same rules", () => {
    const list = [row({ stage: "indexing", progress: 80 })];
    expect(applySnapshot(list, [row({ stage: "parsing_deep", progress: 10 })])[0].stage).toBe(
      "indexing",
    );
    expect(applySnapshot(list, [row({ deleted_at: "x" })])).toEqual([]);
  });
});

describe("what a card says", () => {
  it("uses contract words and honest detail lines", () => {
    expect(sourceStatus(row({}))).toMatchObject({
      word: "Reading",
      pill: "reading",
      line: "Reading page 4 of 12",
      progress: 20,
    });
    expect(sourceStatus(row({ stage: "queued", stage_detail: null }))).toMatchObject({
      word: "Queued",
      line: "Waiting to start",
      progress: null,
    });
    expect(sourceStatus(row({ stage: "uploading" }), 42.7)).toMatchObject({
      word: "Uploading",
      line: "Uploading · 42%",
      progress: 42,
    });
    expect(sourceStatus(row({ stage: "uploading" }))).toMatchObject({
      line: "Uploading",
      progress: null,
    });
    expect(sourceStatus(row({ stage: "ready", page_count: 12 }))).toMatchObject({
      word: "Ready",
      line: "12 pages · Ready",
    });
    expect(sourceStatus(row({ stage: "ready", page_count: 1 })).line).toBe("1 page · Ready");
  });

  it("failed cards give the reason, the fix and the action", () => {
    const s = sourceStatus(row({ stage: "failed", error_code: "unreadable_after_repair" }));
    expect(s).toMatchObject({
      word: "Couldn't read",
      pill: "failed",
      line: "We couldn't read this file, even after trying to repair it.",
      fix: "Try again, or upload a different copy (re-download or re-export it).",
    });
    expect(s.actions).toEqual([
      { id: "retry", label: "Try again" },
      { id: "upload_copy", label: "Upload a different copy" },
    ]);
    const t = sourceStatus(row({ stage: "failed", error_code: "parse_timeout" }));
    expect(t.actions).toEqual([{ id: "retry", label: "Try again" }]);
    expect(sourceStatus(row({ stage: "failed", error_code: "made_up" })).line).toBe(
      "We couldn't finish reading this file.",
    );
    // v1 codes on old rows read as internal; "Try again" re-reads them through v2.
    expect(sourceStatus(row({ stage: "failed", error_code: "encrypted_pdf" })).fix).toBe(
      "Try again in a moment.",
    );
  });

  it("a password wait is a caution, not a failure", () => {
    const s = sourceStatus(row({ stage: "needs_password", stage_detail: null }));
    expect(s).toMatchObject({
      word: "Needs password",
      pill: "needs_password",
      line: "Enter the password to open this PDF",
    });
    expect(s.fix).toBeUndefined();
  });

  it("background tab title counts busy sources", () => {
    expect(backgroundTitle("Transformers", [row({}), row({ id: "2", stage: "ready" })])).toBe(
      "(1 reading) Transformers — TensorLM",
    );
    expect(backgroundTitle("T", [row({ stage: "uploading" })])).toBe("(1 uploading) T — TensorLM");
    expect(backgroundTitle("T", [row({ stage: "ready" })])).toBe("T — TensorLM");
  });

  it("stage timeline and durations", () => {
    const s = row({
      stage_timings: {
        parsing_deep: { started_at: "2026-11-20T10:00:02Z", duration_ms: 64000 },
        validating: { started_at: "2026-11-20T10:00:01Z", duration_ms: 1400 },
      },
    });
    expect(stageTimeline(s).map((t) => [t.stage, t.word, formatDuration(t.durationMs)])).toEqual([
      ["validating", "Reading", "1.4 s"],
      ["parsing_deep", "Improving", "1 min 04 s"],
    ]);
    expect(formatDuration(null)).toBe("—");
  });

  it("middle-truncates names and keeps the extension", () => {
    expect(middleTruncate("attention-is-all-you-need-annotated.pdf")).toBe(
      "attention-is-a…annotated.pdf",
    );
    expect(middleTruncate("short.pdf")).toBe("short.pdf");
  });
});

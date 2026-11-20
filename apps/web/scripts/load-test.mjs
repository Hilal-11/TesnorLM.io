// Ingestion load test (Phase 3 S5) against the LOCAL stack + Inngest Dev Server + worker.
//
//   node scripts/with-local-supabase.mjs --test node scripts/load-test.mjs
//
// Round 1: 5 papers + 1 scanned + 1 corrupt at once → expect 6 Ready and 1 corrupt_pdf.
// Round 2: 10 papers at once → every document reaches a terminal stage, none lost.
// Each document goes the same way the app sends it: a row created as the person (RLS), the file
// uploaded with their session, then `queued` + `document/uploaded`. Prints p50/p95 per stage.
// Writes only to the local/test project; refuses the main project's URL.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.TEST_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_ANON_KEY;
const SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const INNGEST = process.env.INNGEST_EVENT_URL ?? "http://localhost:8288/e/local";
if (!URL_ || !ANON || !SERVICE)
  throw new Error("needs TEST_SUPABASE_* (run through with-local-supabase.mjs --test)");
if (URL_ === process.env.NEXT_PUBLIC_SUPABASE_URL)
  throw new Error("refusing to run against the main project");

const FIXTURES = path.resolve(
  import.meta.dirname,
  "../../../services/worker/tests/fixtures/generated",
);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL_, SERVICE, opts);
const TERMINAL = new Set(["ready", "failed"]);

async function person() {
  const email = `load-${randomUUID()}@example.com`;
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(URL_, ANON, opts);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, client };
}

async function submit(user, notebookId, fixture, n) {
  const bytes = readFileSync(path.join(FIXTURES, `${fixture}.pdf`));
  const { data: doc, error } = await user.client
    .from("documents")
    .insert({
      notebook_id: notebookId,
      user_id: user.id,
      title: `${fixture}-${n}.pdf`,
      original_filename: `${fixture}-${n}.pdf`,
      mime_type: "application/pdf",
      file_size: bytes.length,
    })
    .select("id, ingest_run_id, storage_path")
    .single();
  if (error) throw error;
  const up = await user.client.storage
    .from("documents")
    .upload(doc.storage_path, bytes, { contentType: "application/pdf" });
  if (up.error) throw up.error;
  const queued = await admin.rpc("set_document_stage", {
    p_document_id: doc.id,
    p_run_id: doc.ingest_run_id,
    p_stage: "queued",
  });
  if (queued.error) throw queued.error;
  const res = await fetch(INNGEST, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "document/uploaded",
      id: `uploaded-${doc.ingest_run_id}`,
      data: {
        document_id: doc.id,
        notebook_id: notebookId,
        user_id: user.id,
        run_id: doc.ingest_run_id,
      },
    }),
  });
  if (!res.ok) throw new Error(`event not accepted: ${res.status}`);
  return { id: doc.id, fixture };
}

const pct = (values, p) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};
const secs = (ms) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)} s`);

async function round(label, plan, timeoutMs) {
  const user = await person();
  const { data: nb, error } = await admin
    .from("notebooks")
    .insert({ user_id: user.id, title: label })
    .select("id")
    .single();
  if (error) throw error;
  const started = Date.now();
  const docs = await Promise.all(plan.map((fixture, i) => submit(user, nb.id, fixture, i + 1)));
  let rows = [];
  while (Date.now() - started < timeoutMs) {
    const { data } = await admin
      .from("documents")
      .select("id, stage, error_code, stage_timings, original_filename")
      .in(
        "id",
        docs.map((d) => d.id),
      );
    rows = data ?? [];
    if (rows.length === docs.length && rows.every((r) => TERMINAL.has(r.stage))) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  const wall = Date.now() - started;
  const byStage = {};
  for (const r of rows) {
    for (const [stage, t] of Object.entries(r.stage_timings ?? {})) {
      if (typeof t?.duration_ms === "number") (byStage[stage] ??= []).push(t.duration_ms);
    }
  }
  const outcome = {};
  for (const r of rows) {
    const key = r.stage === "failed" ? `failed:${r.error_code}` : r.stage;
    outcome[key] = (outcome[key] ?? 0) + 1;
  }
  const lost = docs.length - rows.filter((r) => TERMINAL.has(r.stage)).length;
  console.log(`\n${label}: ${docs.length} documents, wall ${secs(wall)}, lost ${lost}`);
  console.log("  outcome:", JSON.stringify(outcome));
  for (const stage of ["queued", "validating", "parsing", "ocr", "reading_figures", "indexing"]) {
    if (byStage[stage])
      console.log(
        `  ${stage.padEnd(16)} p50 ${secs(pct(byStage[stage], 50)).padStart(8)}   p95 ${secs(pct(byStage[stage], 95)).padStart(8)}   n=${byStage[stage].length}`,
      );
  }
  await admin.auth.admin.deleteUser(user.id); // cascade: notebooks, documents, chunks, figures
  return { lost, outcome };
}

// ROUNDS=1 or ROUNDS=2 runs one round only. Don't run test:rls at the same time: its sweeper
// test fails every unfinished run in the database on purpose.
const rounds = (process.env.ROUNDS ?? "1,2").split(",");
const skipped = { lost: 0, outcome: null };
const r1 = !rounds.includes("1")
  ? skipped
  : await round(
      "Load round 1 (5 + scanned + failing)",
      [
        "paper_basic",
        "paper_basic",
        "paper_basic",
        "logo_repeat",
        "logo_repeat",
        "scanned",
        "corrupt",
      ],
      15 * 60_000,
    );
const r2 = !rounds.includes("2")
  ? skipped
  : await round(
      "Load round 2 (10 at once)",
      Array.from({ length: 10 }, (_, i) => (i % 2 ? "logo_repeat" : "paper_basic")),
      25 * 60_000,
    );

const ok =
  (r1.outcome === null ||
    (r1.lost === 0 && r1.outcome.ready === 6 && r1.outcome["failed:corrupt_pdf"] === 1)) &&
  (r2.outcome === null || (r2.lost === 0 && r2.outcome.ready === 10));
console.log(`\nResult: ${ok ? "PASS" : "FAIL"}`);
process.exit(ok ? 0 : 1);

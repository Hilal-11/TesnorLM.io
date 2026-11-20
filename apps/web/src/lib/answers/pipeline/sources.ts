import "server-only";
/**
 * Loading what an answer may cite: the selected Ready sources, every chunk of them (full-context
 * mode) or the best chunks for the question (retrieval mode). Reads use the caller's client, so
 * RLS limits everything to their own notebook.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { LIMITS } from "../format";
import {
  chunkTokens,
  expandWithNeighbours,
  readingOrder,
  rrfMerge,
  type SourceChunk,
} from "./context";

type Db = SupabaseClient<Database>;

export type ReadySource = { id: string; title: string; readyRunId: string; tokens: number };

const CHUNK_FIELDS =
  "id, document_id, chunk_index, content, section, kind, page_start, page_end, bboxes, figure_id, token_count, ingest_run_id";

/** Included, Ready, live sources of a notebook, in the order they were added. */
export async function selectedSources(db: Db, notebookId: string, onlyIds?: string[]) {
  let query = db
    .from("documents")
    .select("id, title, original_filename, ready_run_id, token_count, chunk_count, created_at")
    .eq("notebook_id", notebookId)
    .eq("stage", "ready")
    .eq("included", true)
    .is("deleted_at", null)
    .not("ready_run_id", "is", null)
    .order("created_at", { ascending: true });
  if (onlyIds && onlyIds.length > 0) query = query.in("id", onlyIds);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(
    (d): ReadySource => ({
      id: d.id,
      title: (d.title || d.original_filename).replace(/\.pdf$/i, ""),
      readyRunId: d.ready_run_id!,
      // documents.token_count is the whole text; chunks add a little context on top.
      tokens: Math.ceil((d.token_count ?? d.chunk_count * 400) * 1.1),
    }),
  );
}

type ChunkRow = {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  section: string | null;
  kind: string;
  page_start: number | null;
  page_end: number | null;
  bboxes: unknown;
  figure_id: string | null;
  token_count: number | null;
  ingest_run_id: string;
};

function toChunk(row: ChunkRow, titles: Map<string, string>): SourceChunk {
  return {
    id: row.id,
    document_id: row.document_id,
    document_title: titles.get(row.document_id) ?? "Source",
    chunk_index: row.chunk_index,
    content: row.content,
    section: row.section,
    kind: row.kind,
    page_start: row.page_start,
    page_end: row.page_end,
    bboxes: Array.isArray(row.bboxes) ? (row.bboxes as SourceChunk["bboxes"]) : [],
    figure_id: row.figure_id,
    token_count: row.token_count,
  };
}

/** Every chunk of the published runs, in reading order (full-context mode). */
export async function allChunks(db: Db, sources: ReadySource[]) {
  const titles = new Map(sources.map((s) => [s.id, s.title]));
  const out: SourceChunk[] = [];
  for (const s of sources) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from("chunks")
        .select(CHUNK_FIELDS)
        .eq("document_id", s.id)
        .eq("ingest_run_id", s.readyRunId)
        .order("chunk_index")
        .range(from, from + 999);
      if (error) throw error;
      out.push(...((data ?? []) as ChunkRow[]).map((r) => toChunk(r, titles)));
      if (!data || data.length < 1000) break;
    }
  }
  return readingOrder(out, sources.map((s) => s.id));
}

export type Embed = (text: string) => Promise<number[]>;

/** Hybrid search per query → fusion → top K → neighbours (+ figure captions) within the budget. */
export async function retrieveChunks(
  db: Db,
  notebookId: string,
  sources: ReadySource[],
  queries: string[],
  embed: Embed,
  options: { includeFigures: boolean; topK?: number; budgetTokens?: number },
) {
  const topK = options.topK ?? LIMITS.retrievalTopK;
  const budget = options.budgetTokens ?? LIMITS.retrievalContextTokens;
  const ids = sources.map((s) => s.id);
  const titles = new Map(sources.map((s) => [s.id, s.title]));

  const lists = await Promise.all(
    queries.map(async (q) => {
      const { data, error } = await db.rpc("hybrid_search", {
        query_text: q,
        query_embedding: JSON.stringify(await embed(q)),
        p_notebook_id: notebookId,
        match_count: 20,
        p_document_ids: ids,
      });
      if (error) throw error;
      return (data ?? []).map((r: { id: string }) => r.id);
    }),
  );
  // Reranker hook (Phase 5): reorder `fused` here before taking the top K.
  const fused = rrfMerge(lists).slice(0, topK);
  if (fused.length === 0) return [];

  const { data: topRows, error } = await db.from("chunks").select(CHUNK_FIELDS).in("id", fused);
  if (error) throw error;
  const byId = new Map(((topRows ?? []) as ChunkRow[]).map((r) => [r.id, toChunk(r, titles)]));
  const top = fused.map((id) => byId.get(id)).filter((c): c is SourceChunk => Boolean(c));

  // Neighbours: the chunk before and after each top chunk, same published run.
  const wanted = new Map<string, number[]>();
  for (const c of top) {
    const list = wanted.get(c.document_id) ?? [];
    list.push(c.chunk_index - 1, c.chunk_index + 1);
    wanted.set(c.document_id, list);
  }
  const neighbours: SourceChunk[] = [];
  for (const [docId, indexes] of wanted) {
    const run = sources.find((s) => s.id === docId)?.readyRunId;
    if (!run) continue;
    const { data } = await db
      .from("chunks")
      .select(CHUNK_FIELDS)
      .eq("document_id", docId)
      .eq("ingest_run_id", run)
      .in("chunk_index", indexes.filter((i) => i >= 0));
    neighbours.push(...((data ?? []) as ChunkRow[]).map((r) => toChunk(r, titles)));
  }

  let chosen = expandWithNeighbours(top, neighbours, budget, ids);

  if (options.includeFigures) {
    const used = chosen.reduce((sum, c) => sum + chunkTokens(c), 0);
    const { data: figs } = await db
      .from("chunks")
      .select(CHUNK_FIELDS)
      .in("document_id", ids)
      .eq("kind", "figure_caption")
      .limit(30);
    const live = ((figs ?? []) as ChunkRow[]).filter((r) =>
      sources.some((s) => s.id === r.document_id && s.readyRunId === r.ingest_run_id),
    );
    let room = Math.max(0, budget + 2000 - used);
    const extra: SourceChunk[] = [];
    for (const r of live) {
      if (chosen.some((c) => c.id === r.id)) continue;
      const c = toChunk(r, titles);
      if (chunkTokens(c) > room) break;
      room -= chunkTokens(c);
      extra.push(c);
    }
    chosen = readingOrder([...chosen, ...extra], ids);
  }
  return chosen;
}

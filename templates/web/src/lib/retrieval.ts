import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

const openai = new OpenAI();

export type Chunk = {
  id: string;
  document_id: string;
  section: string | null;
  content: string;
};

/** Small notebooks fit in the model's context — send everything instead of retrieving. */
export const FULL_CONTEXT_TOKEN_LIMIT = 60_000;

export async function embedQuery(text: string) {
  const res = await openai.embeddings.create({
    model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

/** Hybrid (vector + keyword) search, fused with RRF inside Postgres. */
export async function retrieve(
  supabase: SupabaseClient,
  notebookId: string,
  query: string,
  k = 8,
): Promise<Chunk[]> {
  const embedding = await embedQuery(query);
  const { data, error } = await supabase.rpc("hybrid_search", {
    query_text: query,
    query_embedding: embedding,
    p_notebook_id: notebookId,
    match_count: k,
  });
  if (error) throw error;
  // Phase 2: rerank `data` with Cohere Rerank / BGE before returning.
  return data as Chunk[];
}

/** Formats chunks so the model can cite them as [1], [2] ... */
export function formatContext(chunks: Chunk[]) {
  return chunks
    .map((c, i) => `[${i + 1}] (section: ${c.section ?? "n/a"})\n${c.content}`)
    .join("\n\n---\n\n");
}

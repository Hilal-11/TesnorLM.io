/**
 * Turning chunks into the numbered <sources> block the model cites from (spec §2–3), plus the pure
 * helpers for routing, fusion, neighbour expansion and token budgets.
 */
import type { AnswerMode } from "../format";

export type SourceChunk = {
  id: string;
  document_id: string;
  document_title: string;
  chunk_index: number;
  content: string;
  section: string | null;
  kind: string;
  page_start: number | null;
  page_end: number | null;
  bboxes: { page: number; l: number; t: number; r: number; b: number }[];
  figure_id: string | null;
  token_count: number | null;
};

export type SourceRef = Omit<SourceChunk, "content" | "chunk_index" | "token_count"> & {
  n: number;
  quote_preview: string;
};

/** A safe token estimate (≈ 3.5 characters per token for English prose, rounded up). */
export const estimateTokens = (text: string) => Math.ceil(text.length / 3.5);
export const chunkTokens = (c: Pick<SourceChunk, "content" | "token_count">) =>
  c.token_count ?? estimateTokens(c.content);

export type RoutableDoc = { id: string; tokens: number };

/** Which mode answers this question (spec §2). */
export function chooseMode(docs: RoutableDoc[], fullContextLimit: number): AnswerMode {
  if (docs.length === 0) return "no_sources";
  const total = docs.reduce((sum, d) => sum + d.tokens, 0);
  return total <= fullContextLimit ? "full_context" : "retrieval";
}

/** Reading order: the order sources were added, then chunk order. Stable, so the prefix caches. */
export function readingOrder(chunks: SourceChunk[], docOrder: string[]) {
  const rank = new Map(docOrder.map((id, i) => [id, i]));
  return [...chunks].sort(
    (a, b) =>
      (rank.get(a.document_id) ?? 1e9) - (rank.get(b.document_id) ?? 1e9) ||
      a.chunk_index - b.chunk_index,
  );
}

/** Reciprocal rank fusion of several ranked id lists (k = 60), best first, deduplicated. */
export function rrfMerge(lists: string[][], k = 60): string[] {
  const score = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, rank) => score.set(id, (score.get(id) ?? 0) + 1 / (k + rank + 1)));
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/**
 * Adds each top chunk's neighbours (previous/next chunk of the same document) while the budget
 * allows, then returns everything in reading order. Top chunks always come first in priority.
 */
export function expandWithNeighbours(
  top: SourceChunk[],
  neighbours: SourceChunk[],
  budgetTokens: number,
  docOrder: string[],
) {
  const chosen = new Map<string, SourceChunk>();
  let used = 0;
  for (const c of top) {
    const t = chunkTokens(c);
    if (used + t > budgetTokens && chosen.size > 0) break;
    chosen.set(c.id, c);
    used += t;
  }
  const key = (c: SourceChunk) => `${c.document_id}:${c.chunk_index}`;
  const byPos = new Map(neighbours.map((n) => [key(n), n]));
  for (const c of [...chosen.values()]) {
    for (const delta of [-1, 1]) {
      const n = byPos.get(`${c.document_id}:${c.chunk_index + delta}`);
      if (!n || chosen.has(n.id)) continue;
      const t = chunkTokens(n);
      if (used + t > budgetTokens) continue;
      chosen.set(n.id, n);
      used += t;
    }
  }
  return readingOrder([...chosen.values()], docOrder);
}

const escapeAttr = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Document text can't close our tags or open new ones. */
const escapeText = (value: string) =>
  value.replace(/<\/?(source|sources|focus)\b/gi, (m) => m.replace("<", "&lt;"));

export function pageLabel(start: number | null, end: number | null) {
  if (!start) return "";
  return end && end !== start ? `${start}–${end}` : String(start);
}

/** The numbered <sources> block and the map n → chunk the server validates citations against. */
export function buildContext(chunks: SourceChunk[], quoteChars = 300) {
  const sourceMap = new Map<number, SourceRef>();
  const blocks = chunks.map((c, i) => {
    const n = i + 1;
    sourceMap.set(n, {
      n,
      id: c.id,
      document_id: c.document_id,
      document_title: c.document_title,
      section: c.section,
      kind: c.kind,
      page_start: c.page_start,
      page_end: c.page_end,
      bboxes: c.bboxes ?? [],
      figure_id: c.figure_id,
      quote_preview: c.content.replace(/\s+/g, " ").trim().slice(0, quoteChars),
    });
    const attrs = [
      `n="${n}"`,
      `document="${escapeAttr(c.document_title)}"`,
      c.page_start ? `pages="${pageLabel(c.page_start, c.page_end)}"` : "",
      c.section ? `section="${escapeAttr(c.section)}"` : "",
      `kind="${escapeAttr(c.kind)}"`,
    ]
      .filter(Boolean)
      .join(" ");
    return `<source ${attrs}>\n${escapeText(c.content)}\n</source>`;
  });
  return {
    contextText: chunks.length > 0 ? `<sources>\n${blocks.join("\n")}\n</sources>` : "",
    sourceMap,
  };
}

/** History as plain text, without citation markup, trimmed oldest-first to the budget. */
export function formatHistory(
  turns: { role: "user" | "assistant"; text: string }[],
  budgetTokens: number,
) {
  const cleaned = turns.map((t) => ({
    role: t.role,
    text: t.text.replace(/\s?\[\d+(?:\s*[,–-]\s*\d+)*\]/g, "").trim(),
  }));
  const kept: typeof cleaned = [];
  let used = 0;
  for (let i = cleaned.length - 1; i >= 0; i -= 1) {
    const t = estimateTokens(cleaned[i].text);
    if (used + t > budgetTokens) break;
    kept.unshift(cleaned[i]);
    used += t;
  }
  return kept;
}

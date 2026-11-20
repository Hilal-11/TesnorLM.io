/**
 * Turning [n] in the model's text into trustworthy citations (spec §5): parse outside code and
 * math, drop numbers the model wasn't given, collapse duplicates and renumber by first appearance.
 * The client never trusts raw model output for citations.
 */
import type { Citation } from "@/lib/chats/shared";
import type { SourceRef } from "./pipeline/context";

// [1] · [1, 2] · [1–3] · [1-3] · [1, 3–5]
const CITE = /\[(\d{1,4}(?:\s*(?:,|–|-|—)\s*\d{1,4})*)\]/g;

/** Splits text into prose and protected spans (fenced code, inline code, display/inline math). */
function segments(text: string) {
  const protectedRe = /```[\s\S]*?(?:```|$)|`[^`\n]*`|\$\$[\s\S]*?(?:\$\$|$)|\$[^$\n]+\$/g;
  const out: { text: string; prose: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(protectedRe)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), prose: true });
    out.push({ text: m[0], prose: false });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), prose: true });
  return out;
}

/** The numbers inside one citation group: "1, 3–5" → [1, 3, 4, 5]. */
export function expandGroup(group: string): number[] {
  const nums: number[] = [];
  for (const piece of group.split(",")) {
    const range = piece.split(/[–\-—]/).map((s) => Number.parseInt(s.trim(), 10));
    if (range.length === 2 && range.every(Number.isFinite) && range[1] >= range[0] && range[1] - range[0] < 20) {
      for (let n = range[0]; n <= range[1]; n += 1) nums.push(n);
    } else if (range.length === 1 && Number.isFinite(range[0])) nums.push(range[0]);
  }
  return nums;
}

export type MappedCitations = {
  text: string;
  citations: Citation[];
  invalid: number;
  /** original n → displayed n */
  renumber: Map<number, number>;
};

/**
 * Validates and renumbers citations. Numbers above the source count that look like years or other
 * figures (e.g. "[2023]") are left alone; other unknown numbers are removed and counted.
 */
export function mapCitations(text: string, sourceMap: Map<number, SourceRef>): MappedCitations {
  const renumber = new Map<number, number>();
  const citations: Citation[] = [];
  let invalid = 0;
  const maxN = sourceMap.size;

  const rewritten = segments(text)
    .map((seg) => {
      if (!seg.prose) return seg.text;
      return seg.text.replace(CITE, (whole, group: string) => {
        const nums = expandGroup(group);
        if (nums.length === 1 && nums[0] > maxN && nums[0] >= 1000) return whole; // a year, not a citation
        const kept: number[] = [];
        for (const n of nums) {
          const ref = sourceMap.get(n);
          if (!ref) {
            invalid += 1;
            continue;
          }
          if (!renumber.has(n)) {
            const shown = renumber.size + 1;
            renumber.set(n, shown);
            citations.push({
              n: shown,
              chunk_id: ref.id,
              document_id: ref.document_id,
              document_title: ref.document_title,
              page_start: ref.page_start,
              page_end: ref.page_end,
              bboxes: ref.bboxes,
              kind: ref.kind,
              figure_id: ref.figure_id,
              section: ref.section,
              quote_preview: ref.quote_preview,
            });
          }
          const shown = renumber.get(n)!;
          if (!kept.includes(shown)) kept.push(shown);
        }
        return kept.length > 0 ? `[${kept.sort((a, b) => a - b).join(", ")}]` : "";
      });
    })
    .join("")
    .replace(/ +([.,;:!?])/g, "$1");

  return { text: rewritten, citations, invalid, renumber };
}

const GENERAL = /^:::general\b/m;

/** Grounded-mode answer with no citations and no general-knowledge block (spec §5). */
export function isUngrounded(mode: string, mapped: Pick<MappedCitations, "citations" | "text">) {
  return mode !== "no_sources" && mapped.citations.length === 0 && !GENERAL.test(mapped.text);
}

/** Citation markup removed (history, copy as plain text). */
export const stripCitations = (text: string) =>
  text.replace(/\s?\[\d+(?:\s*[,–\-—]\s*\d+)*\]/g, "");

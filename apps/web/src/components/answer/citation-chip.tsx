"use client";

import { ArrowUpRight, FileText, ImageIcon } from "lucide-react";
import { createContext, useContext, useRef, useState } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { Citation } from "@/lib/chats/shared";
import { cn } from "@/lib/utils";

/** What chips need from the answer around them. */
export type CitationContextValue = {
  citations: Citation[];
  /** While streaming, the provisional map (title + pages) before validation. */
  provisional?: Map<number, { document_title: string; page_start: number | null; page_end: number | null }>;
  onOpen?: (citation: Citation) => void;
};

export const CitationContext = createContext<CitationContextValue>({ citations: [] });

export function pages(start: number | null, end: number | null) {
  if (!start) return "";
  return end && end !== start ? `pages ${start}–${end}` : `page ${start}`;
}
const short = (start: number | null, end: number | null) =>
  !start ? "" : end && end !== start ? `pp. ${start}–${end}` : `p. ${start}`;

/** [n] chips for one citation group ("[1, 2]"). */
export function CitationChips({ numbers }: { numbers: number[] }) {
  return (
    <span className="whitespace-nowrap">
      {numbers.map((n) => (
        <CitationChip key={n} n={n} />
      ))}
    </span>
  );
}

/**
 * One citation (skill 8.3): r-xs, accent fill. Hover or focus shows the preview after 300 ms,
 * long-press on touch; click (or Enter) opens the source at the page with the passage highlighted.
 */
export function CitationChip({ n }: { n: number }) {
  const ctx = useContext(CitationContext);
  const citation = ctx.citations.find((c) => c.n === n);
  const provisional = ctx.provisional?.get(n);
  const title = citation?.document_title ?? provisional?.document_title;
  const pageText = citation ? pages(citation.page_start, citation.page_end) : provisional ? pages(provisional.page_start, provisional.page_end) : "";
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pressed = useRef(false);

  const later = (fn: () => void, ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };
  const label = title ? `Source ${n}: ${title}${pageText ? `, ${pageText}` : ""}` : `Source ${n}`;

  return (
    <Popover open={open && Boolean(citation)} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          type="button"
          data-slot="citation-chip"
          aria-label={label}
          onPointerEnter={(e) => e.pointerType === "mouse" && later(() => setOpen(true), 300)}
          onPointerLeave={(e) => e.pointerType === "mouse" && later(() => setOpen(false), 200)}
          onPointerDown={(e) => {
            if (e.pointerType !== "touch") return;
            pressed.current = false;
            later(() => {
              pressed.current = true;
              setOpen(true);
            }, 450);
          }}
          onPointerUp={() => clearTimeout(timer.current)}
          onFocus={() => later(() => setOpen(true), 300)}
          onBlur={() => later(() => setOpen(false), 150)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          onClick={(e) => {
            if (pressed.current) {
              e.preventDefault(); // a long-press opened the preview; don't also jump
              pressed.current = false;
              return;
            }
            setOpen(false);
            if (citation) ctx.onOpen?.(citation);
          }}
          className={cn(
            "interactive mx-px inline-flex h-[1.15rem] min-w-5 cursor-pointer items-center justify-center rounded-xs px-1 align-[0.12em]",
            "bg-accent font-sans text-caption font-medium text-ink tabular-nums hover:bg-muted",
            !citation && "cursor-default text-graphite",
          )}
        >
          {n}
        </button>
      </PopoverAnchor>
      {citation && (
        <PopoverContent
          side="top"
          align="start"
          className="w-80"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerEnter={() => clearTimeout(timer.current)}
          onPointerLeave={() => later(() => setOpen(false), 200)}
        >
          <CitationPreview citation={citation} onOpen={() => ctx.onOpen?.(citation)} />
        </PopoverContent>
      )}
    </Popover>
  );
}

export function CitationPreview({ citation, onOpen }: { citation: Citation; onOpen?: () => void }) {
  const figure = citation.kind === "figure_caption";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-small text-graphite">
        {figure ? <ImageIcon aria-hidden className="size-4 shrink-0" /> : <FileText aria-hidden className="size-4 shrink-0" />}
        <span className="truncate font-medium text-ink">{citation.document_title}</span>
        <span className="shrink-0 tabular-nums">{short(citation.page_start, citation.page_end)}</span>
      </div>
      {citation.section && !figure && <p className="text-caption text-graphite">{citation.section}</p>}
      <blockquote className="text-body-read text-ink">
        <mark className="rounded-xs bg-highlight box-decoration-clone px-0.5 text-ink">
          {citation.quote_preview}
          {citation.quote_preview.length >= 300 ? "…" : ""}
        </mark>
      </blockquote>
      {onOpen && (
        <Button variant="link" size="sm" trailingIcon={ArrowUpRight} className="self-start" onClick={onOpen}>
          Open in source
        </Button>
      )}
    </div>
  );
}

/** "Sources" under an answer: each cited document with its pages, as links into the viewer. */
export function SourcesFooter() {
  const { citations, onOpen } = useContext(CitationContext);
  if (citations.length === 0) return null;
  return (
    <div className="mt-4 border-t border-rule pt-3">
      <p className="mb-1 text-caption font-medium text-graphite">Sources</p>
      <ol className="flex flex-col gap-0.5 text-small">
        {citations.map((c) => (
          <li key={c.n} className="flex gap-2">
            <span className="w-5 shrink-0 text-right text-graphite tabular-nums">{c.n}</span>
            <button
              type="button"
              onClick={() => onOpen?.(c)}
              className="min-w-0 truncate text-left link-underline text-ink"
            >
              {c.document_title}
              <span className="text-graphite">{c.page_start ? `, ${short(c.page_start, c.page_end)}` : ""}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

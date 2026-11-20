"use client";

import { Copy, Download, Lightbulb, MessageSquareQuote, Minus, NotebookPen, Plus, RotateCcw } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { LIMITS } from "@/lib/answers/format";
import { boxToRect, loadPdfJs, type Box } from "@/lib/pdf/pdfjs";
import { cn } from "@/lib/utils";

export type PdfFocus = { page: number; boxes: Box[]; key: number };
export type PdfSelection = { text: string; page: number };

type Size = { width: number; height: number };

const ZOOMS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

function PdfPage({
  doc,
  number,
  scale,
  base,
  render,
  boxes,
  flashKey,
}: {
  doc: PDFDocumentProxy;
  number: number;
  scale: number;
  base: Size;
  render: boolean;
  boxes: Box[];
  flashKey: number | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    if (!render) return;
    let task: RenderTask | null = null;
    let live = true;
    void (async () => {
      const [pdfjs, page] = await Promise.all([loadPdfJs(), doc.getPage(number)]);
      if (!live || !canvas.current || !text.current) return;
      const viewport = page.getViewport({ scale });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const c = canvas.current;
      c.width = Math.floor(viewport.width * ratio);
      c.height = Math.floor(viewport.height * ratio);
      c.style.width = `${viewport.width}px`;
      c.style.height = `${viewport.height}px`;
      setSize({ width: viewport.width, height: viewport.height });
      task = page.render({
        canvas: c,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      });
      await task.promise.catch(() => undefined);
      if (!live || !text.current) return;
      setDrawn(true);
      text.current.replaceChildren();
      text.current.style.setProperty("--total-scale-factor", String(scale));
      const layer = new pdfjs.TextLayer({
        textContentSource: page.streamTextContent(),
        container: text.current,
        viewport,
      });
      await layer.render().catch(() => undefined);
    })();
    return () => {
      live = false;
      task?.cancel();
    };
  }, [doc, number, scale, render]);

  const shown = size ?? { width: base.width * scale, height: base.height * scale };

  return (
    <div
      data-page={number}
      role="region"
      aria-label={`Page ${number}`}
      className="relative mx-auto bg-white shadow-1 ring-1 ring-rule"
      style={{ width: shown.width, height: shown.height }}
    >
      {!drawn && <Skeleton className="absolute inset-0 rounded-none" />}
      <canvas ref={canvas} aria-hidden className="absolute inset-0" />
      <div ref={text} className="textLayer" />
      {boxes.map((box, i) => {
        const r = boxToRect(box, scale);
        return (
          <span
            key={`${flashKey}-${i}`}
            aria-hidden
            data-slot="pdf-highlight"
            className="pointer-events-none absolute z-2 rounded-xs bg-highlight/55 mix-blend-multiply ring-1 ring-highlight motion-safe:animate-[highlight-in_var(--dur-slow)_var(--ease-out)]"
            style={{ left: r.left - 2, top: r.top - 2, width: r.width + 4, height: r.height + 4 }}
          />
        );
      })}
    </div>
  );
}

type PdfViewerProps = {
  documentId: string;
  title: string;
  focus: PdfFocus | null;
  onAsk: (sel: PdfSelection) => void;
  onExplain: (sel: PdfSelection) => void;
  onSaveNote: (sel: PdfSelection) => void;
};

/**
 * The source PDF (pdf.js from /vendor/pdfjs): fit-to-width pages rendered as they scroll near,
 * a selectable text layer, citation highlights from chunk bboxes, and a floating toolbar for a
 * selection (Ask about this · Explain · Save note · Copy).
 */
export function PdfViewer({ documentId, title, focus, onAsk, onExplain, onSaveNote }: PdfViewerProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [base, setBase] = useState<Size | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [visible, setVisible] = useState<Set<number>>(() => new Set([1, 2]));
  const [current, setCurrent] = useState(1);
  const [selection, setSelection] = useState<(PdfSelection & { x: number; y: number }) | null>(null);

  // Load the document through a short-lived signed link.
  useEffect(() => {
    let live = true;
    let task: { destroy: () => Promise<void> } | null = null;
    void (async () => {
      try {
        const res = await apiFetch(`/api/documents/${documentId}/download?json=1`);
        if (!res.ok) throw new Error("link");
        const { url } = (await res.json()) as { url: string };
        const pdfjs = await loadPdfJs();
        const loading = pdfjs.getDocument({ url, disableAutoFetch: true });
        task = loading;
        const loaded = await loading.promise;
        const first = await loaded.getPage(1);
        const v = first.getViewport({ scale: 1 });
        if (!live) return;
        setBase({ width: v.width, height: v.height });
        setDoc(loaded);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
      void task?.destroy();
    };
  }, [documentId, attempt]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const fit = base && width ? Math.max(0.3, (width - 32) / base.width) : 1;
  const scale = fit * zoom;

  // Render pages near the viewport; track the page in view.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !doc) return;
    const near = new IntersectionObserver(
      (entries) => {
        setVisible((prev) => {
          const next = new Set(prev);
          for (const e of entries) if (e.isIntersecting) next.add(Number((e.target as HTMLElement).dataset.page));
          return next.size === prev.size ? prev : next;
        });
      },
      { root: el, rootMargin: "100% 0px" },
    );
    const inView = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (top) setCurrent(Number((top.target as HTMLElement).dataset.page));
      },
      { root: el, threshold: [0.25, 0.5, 0.75] },
    );
    el.querySelectorAll("[data-page]").forEach((p) => {
      near.observe(p);
      inView.observe(p);
    });
    return () => {
      near.disconnect();
      inView.disconnect();
    };
  }, [doc, scale]);

  // A citation opened: scroll its first box into view.
  useEffect(() => {
    const el = scroller.current;
    if (!focus || !el || !doc) return;
    setVisible((prev) => new Set(prev).add(focus.page));
    const page = el.querySelector<HTMLElement>(`[data-page="${focus.page}"]`);
    if (!page) return;
    const first = focus.boxes.find((b) => b.page === focus.page);
    const offset = first ? boxToRect(first, scale).top - 48 : 0;
    el.scrollTo({ top: page.offsetTop + Math.max(0, offset), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [focus, doc, scale]);

  const readSelection = useCallback(() => {
    const el = scroller.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.isCollapsed || sel.rangeCount === 0) return setSelection(null);
    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const pageEl = (node.nodeType === 1 ? (node as Element) : node.parentElement)?.closest<HTMLElement>("[data-page]");
    const textValue = sel.toString().replace(/\s+/g, " ").trim();
    if (!pageEl || !el.contains(pageEl) || textValue.length < 2) return setSelection(null);
    const rect = range.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    setSelection({
      text: textValue.slice(0, LIMITS.quoteChars),
      page: Number(pageEl.dataset.page),
      x: rect.left - box.left + rect.width / 2,
      y: rect.top - box.top + el.scrollTop,
    });
  }, []);

  useEffect(() => {
    const onChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setSelection(null);
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, []);

  const act = (fn: (s: PdfSelection) => void) => {
    if (!selection) return;
    fn({ text: selection.text, page: selection.page });
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  };

  const zoomBy = (step: 1 | -1) => {
    const i = ZOOMS.findIndex((z) => z >= zoom - 0.001);
    setZoom(ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, (i < 0 ? 4 : i) + step))]);
  };

  return (
    <div data-slot="pdf-viewer" className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-rule px-2 text-small text-graphite">
        <span className="min-w-0 flex-1 truncate font-medium text-ink" title={title}>
          {title}
        </span>
        {doc && (
          <span className="tabular-nums" aria-live="polite">
            Page {current} of {doc.numPages}
          </span>
        )}
        <IconButton icon={Minus} size="sm" aria-label="Zoom out" disabled={!doc || zoom <= ZOOMS[0]} onClick={() => zoomBy(-1)} />
        <button
          type="button"
          className="interactive h-7 min-w-12 rounded-sm px-1 tabular-nums hover:bg-muted"
          onClick={() => setZoom(1)}
          aria-label="Fit to width"
          title="Fit to width"
        >
          {Math.round(zoom * 100)}%
        </button>
        <IconButton icon={Plus} size="sm" aria-label="Zoom in" disabled={!doc || zoom >= ZOOMS.at(-1)!} onClick={() => zoomBy(1)} />
        <IconButton
          icon={Download}
          size="sm"
          aria-label="Download PDF"
          onClick={() => window.open(`/api/documents/${documentId}/download`, "_blank", "noopener")}
        />
      </div>

      <div
        ref={scroller}
        className="relative min-h-0 flex-1 overflow-auto bg-subtle"
        onPointerUp={() => requestAnimationFrame(readSelection)}
        onKeyUp={(e) => {
          if (e.key === "Escape") return setSelection(null);
          if (e.shiftKey) readSelection();
        }}
      >
        {failed ? (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-small text-graphite">
            <p>We couldn&apos;t open this PDF here.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" leadingIcon={RotateCcw} onClick={() => {
                  setFailed(false);
                  setAttempt((a) => a + 1);
                }}>
                Try again
              </Button>
              <Button size="sm" variant="ghost" leadingIcon={Download} onClick={() => window.open(`/api/documents/${documentId}/download`, "_blank", "noopener")}>
                Download
              </Button>
            </div>
          </div>
        ) : !doc || !base ? (
          <div className="flex flex-col gap-4 p-4" aria-busy="true" aria-label="Opening the PDF">
            <Skeleton className="mx-auto aspect-[8.5/11] w-full max-w-2xl" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {Array.from({ length: doc.numPages }, (_, i) => i + 1).map((n) => (
              <PdfPage
                key={n}
                doc={doc}
                number={n}
                scale={scale}
                base={base}
                render={visible.has(n)}
                boxes={focus ? focus.boxes.filter((b) => b.page === n) : []}
                flashKey={focus?.key ?? null}
              />
            ))}
          </div>
        )}

        {selection && (
          <div
            role="toolbar"
            aria-label="Selected text"
            className="absolute z-10 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-md border border-rule bg-sheet-2 p-1 shadow-3"
            style={{ left: selection.x, top: selection.y - 8 }}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <Button size="sm" variant="ghost" leadingIcon={MessageSquareQuote} onClick={() => act(onAsk)}>
              Ask about this
            </Button>
            <Button size="sm" variant="ghost" leadingIcon={Lightbulb} onClick={() => act(onExplain)}>
              Explain
            </Button>
            <Button size="sm" variant="ghost" leadingIcon={NotebookPen} onClick={() => act(onSaveNote)}>
              Save note
            </Button>
            <IconButton
              icon={Copy}
              size="sm"
              aria-label="Copy"
              onClick={() =>
                act((s) => {
                  void navigator.clipboard.writeText(s.text).then(
                    () => toast.success("Copied"),
                    () => toast.error("Couldn't copy"),
                  );
                })
              }
            />
          </div>
        )}
      </div>
      <p className={cn("sr-only")} aria-live="polite">
        {focus ? `Showing page ${focus.page}` : ""}
      </p>
    </div>
  );
}

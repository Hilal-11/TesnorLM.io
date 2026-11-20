"use client";

import { FileText, Info, Network, X } from "lucide-react";
import { useState } from "react";
import { DiagramCard } from "@/components/answer/diagram-card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import type { Source } from "@/lib/documents/shared";
import { cn } from "@/lib/utils";
import { SourceDetail } from "../source-detail";
import { PdfViewer, type PdfFocus, type PdfSelection } from "./pdf-viewer";

export type CanvasTab = "source" | "diagram";

type CanvasProps = {
  tab: CanvasTab;
  onTab: (tab: CanvasTab) => void;
  source: Source | null;
  focus: PdfFocus | null;
  diagram: { code: string; title: string } | null;
  onClose: () => void;
  onReprocess: (source: Source) => void;
  onAsk: (source: Source, sel: PdfSelection) => void;
  onExplain: (source: Source, sel: PdfSelection) => void;
  onSaveNote: (source: Source, sel: PdfSelection) => void;
};

/** The right pane: the cited PDF (with highlights and selection tools) or a diagram, large. */
export function Canvas({ tab, onTab, source, focus, diagram, onClose, onReprocess, onAsk, onExplain, onSaveNote }: CanvasProps) {
  const [details, setDetails] = useState(false);
  const tabs: { id: CanvasTab; label: string; icon: typeof FileText; off: boolean }[] = [
    { id: "source", label: "Source", icon: FileText, off: !source },
    { id: "diagram", label: "Diagram", icon: Network, off: !diagram },
  ];

  return (
    <section aria-label="Canvas" className="flex h-full min-h-0 flex-col bg-sheet">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-rule px-2">
        <div role="tablist" aria-label="Canvas" className="flex items-center gap-0.5">
          {tabs.map(({ id, label, icon: Icon, off }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`canvas-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`canvas-panel-${id}`}
              disabled={off}
              onClick={() => onTab(id)}
              className={cn(
                "interactive inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-small disabled:opacity-40",
                tab === id ? "bg-muted font-medium text-ink" : "text-graphite hover:text-ink",
              )}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {tab === "source" && source && (
          <IconButton
            icon={Info}
            size="sm"
            aria-label="Source details"
            aria-pressed={details}
            onClick={() => setDetails((d) => !d)}
          />
        )}
        <IconButton icon={X} size="sm" aria-label="Close canvas" onClick={onClose} />
      </div>

      <div
        role="tabpanel"
        id={`canvas-panel-${tab}`}
        aria-labelledby={`canvas-tab-${tab}`}
        className="min-h-0 flex-1"
      >
        {tab === "source" ? (
          !source ? (
            <EmptyState titleAs="h2" icon={FileText} title="No source open" description="Click a citation or a source to open it here." />
          ) : details || source.stage !== "ready" ? (
            <div className="h-full overflow-y-auto p-5">
              <SourceDetail source={source} onReprocess={onReprocess} />
            </div>
          ) : (
            <PdfViewer
              key={source.id}
              documentId={source.id}
              title={source.original_filename}
              focus={focus}
              onAsk={(sel) => onAsk(source, sel)}
              onExplain={(sel) => onExplain(source, sel)}
              onSaveNote={(sel) => onSaveNote(source, sel)}
            />
          )
        ) : diagram ? (
          <div className="h-full overflow-auto p-5">
            <DiagramCard code={diagram.code} />
          </div>
        ) : (
          <EmptyState titleAs="h2" icon={Network} title="No diagram open" description="Open a diagram from an answer to see it large." />
        )}
      </div>
    </section>
  );
}

"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { Code2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

function render(tex: string, display: boolean) {
  try {
    return { html: katex.renderToString(tex, { displayMode: display, throwOnError: true, strict: "ignore", trust: false }), ok: true };
  } catch {
    return { html: "", ok: false };
  }
}

/** Inline formula; a LaTeX error shows the source in mono instead of breaking the message. */
export function InlineMath({ tex }: { tex: string }) {
  const { html, ok } = useMemo(() => render(tex, false), [tex]);
  if (!ok) return <code className="rounded-xs bg-muted px-1 font-mono text-[0.92em]">{tex}</code>;
  return <span className="katex-inline" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Display formula with "Show LaTeX" and copy (skill 8.3). */
export function MathBlock({ tex }: { tex: string }) {
  const { html, ok } = useMemo(() => render(tex, true), [tex]);
  const [source, setSource] = useState(!ok);
  return (
    <div data-slot="math-block" className="group/math relative my-4 rounded-sm">
      {source ? (
        <pre className="overflow-x-auto rounded-sm bg-muted p-3 text-code">{tex}</pre>
      ) : (
        <div className="overflow-x-auto py-1" dangerouslySetInnerHTML={{ __html: html }} />
      )}
      <div
        className={cn(
          "mt-1 flex items-center gap-1 text-small text-graphite",
          "opacity-0 transition-opacity duration-(--dur-fast) group-focus-within/math:opacity-100 group-hover/math:opacity-100 pointer-coarse:opacity-100",
        )}
      >
        {ok && (
          <button
            type="button"
            onClick={() => setSource((s) => !s)}
            aria-pressed={source}
            className="interactive inline-flex h-7 items-center gap-1 rounded-sm px-2 hover:bg-muted hover:text-ink"
          >
            <Code2 aria-hidden className="size-3.5" />
            {source ? "Show formula" : "Show LaTeX"}
          </button>
        )}
        <CopyButton value={tex} label="Copy LaTeX" />
        {!ok && <span>This formula couldn&apos;t be drawn; here is its LaTeX.</span>}
      </div>
    </div>
  );
}

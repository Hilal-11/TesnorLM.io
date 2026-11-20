"use client";

import { WrapText } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

/** Code block (skill 8.3): language top-left in graphite, copy top-right, a wrap toggle. */
export function CodeBlock({ code, language }: { code: string; language: string | null }) {
  const [wrap, setWrap] = useState(false);
  return (
    <div data-slot="code-block" className="my-4 overflow-hidden rounded-md border border-rule bg-subtle">
      <div className="flex h-9 items-center justify-between gap-2 border-b border-rule px-3">
        <span className="text-caption text-graphite">{language || "Code"}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-pressed={wrap}
            onClick={() => setWrap((w) => !w)}
            className="interactive inline-flex h-7 items-center gap-1 rounded-sm px-2 text-small text-graphite hover:bg-muted hover:text-ink"
          >
            <WrapText aria-hidden className="size-3.5" />
            Wrap
          </button>
          <CopyButton value={code} label="Copy code" />
        </div>
      </div>
      <pre className={cn("overflow-x-auto p-3 text-code text-ink", wrap && "break-words whitespace-pre-wrap")}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

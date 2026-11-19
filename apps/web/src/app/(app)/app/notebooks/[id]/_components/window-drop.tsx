"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Drag files anywhere over the notebook page: the full-window drop zone fades in (220 ms, none
 * with reduced motion) with the drop wash and "Drop to add to this notebook" (skill 8.2).
 */
export function WindowDropZone({
  onFiles,
  disabled = false,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (disabled) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setActive(true);
    };
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setActive(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setActive(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) onFiles(files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [onFiles, disabled]);

  return (
    <div
      aria-hidden={!active}
      data-active={active || undefined}
      data-slot="window-drop-zone"
      className={cn(
        "pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-6 drop-wash",
        "opacity-0 transition-opacity duration-(--dur-base) ease-out motion-reduce:transition-none",
        "data-active:opacity-100",
      )}
    >
      <div className="rounded-lg border-2 border-dashed border-primary bg-sheet px-8 py-6 shadow-2">
        <p className="text-h3 text-ink">Drop to add to this notebook</p>
      </div>
    </div>
  );
}

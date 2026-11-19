"use client";

import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDuration, sourceStatus, stageTimeline } from "@/lib/documents/live";
import { downloadOriginal } from "@/lib/documents/download";
import { formatBytes, type Source } from "@/lib/documents/shared";
import { detailLine, errorCopy } from "@/lib/ingestion/contract";

/** The selected source: what it is, where it is in the pipeline, and how long each stage took. */
export function SourceDetail({
  source,
  onReprocess,
}: {
  source: Source;
  onReprocess: (source: Source) => void;
}) {
  const status = sourceStatus(source);
  const timeline = stageTimeline(source);
  const facts = [
    source.page_count ? `${source.page_count} ${source.page_count === 1 ? "page" : "pages"}` : null,
    source.file_size ? formatBytes(source.file_size) : null,
    source.stage === "ready" ? `${source.chunk_count} passages` : null,
    source.stage === "ready" && source.figure_count > 0
      ? `${source.figure_count} ${source.figure_count === 1 ? "figure" : "figures"}`
      : null,
    source.ocr_used ? "Scanned pages read with OCR" : null,
  ].filter(Boolean);

  return (
    <section aria-labelledby="source-detail-heading" className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h2 id="source-detail-heading" className="text-h2 break-words text-ink">
          {source.original_filename}
        </h2>
        {facts.length > 0 && <p className="text-small text-graphite">{facts.join(" · ")}</p>}
        <StatusPill status={status.pill} detail={status.line} className="max-w-full px-0" />
        {status.fix && <p className="text-small text-graphite">{status.fix}</p>}
      </header>

      <div className="flex flex-wrap gap-2">
        {source.stage !== "uploading" && (
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={Download}
            onClick={() => downloadOriginal(source.id)}
          >
            Download original
          </Button>
        )}
        {(source.stage === "ready" || source.stage === "failed") && (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={RotateCcw}
            onClick={() => onReprocess(source)}
          >
            {source.stage === "failed" ? "Try again" : "Read again"}
          </Button>
        )}
      </div>

      {timeline.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-h3 text-ink">Stages</h3>
          <ol
            aria-label="Stage timeline"
            className="flex flex-col divide-y divide-rule rounded-md border border-rule"
          >
            {timeline.map((t) => (
              <li
                key={t.stage}
                className="flex items-center justify-between gap-3 px-3 py-2 text-small"
              >
                <span className="text-ink">
                  {t.word}
                  <span className="text-graphite">
                    {" · "}
                    {t.stage === "failed"
                      ? errorCopy(source.error_code).message
                      : detailLine(t.stage)}
                  </span>
                </span>
                <span className="text-graphite tabular-nums">
                  {t.durationMs !== null
                    ? formatDuration(t.durationMs)
                    : t.stage === "ready" || t.stage === "failed"
                      ? ""
                      : "In progress"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

"use client";

import { FileText, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress";
import { StatusPill } from "@/components/ui/status-pill";
import { formatBytes, middleTruncate, type Source } from "@/lib/documents/shared";
import { LIMITS } from "@/lib/ingestion/contract";
import { getUploadManager, useUploads } from "@/lib/uploads/browser";
import type { UploadItem } from "@/lib/uploads/manager";
import { cn } from "@/lib/utils";
import { isBusy, uploadStatus } from "./upload-status";

export const ACCEPT = "application/pdf,.pdf";
export const HELPER = `PDF · up to ${LIMITS.maxUploadMb} MB and ${LIMITS.maxPages} pages · ${LIMITS.maxFilesPerBatch} files at a time`;

/**
 * "Add sources": a drop zone with Browse files, the (coming soon) link field and one row per file.
 * Closing it never stops an upload: they keep running in the background.
 */
export function UploadDialog({
  open,
  onOpenChange,
  notebookId,
  sources,
  onAdd,
  onOpenSource,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notebookId: string;
  sources: Source[];
  onAdd: (files: File[]) => void;
  onOpenSource: (id: string) => void;
}) {
  const { items, announcement } = useUploads();
  const rows = items.filter((i) => i.notebookId === notebookId);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const byId = new Map(sources.map((s) => [s.id, s]));

  const pick = (files: FileList | null) => {
    if (files && files.length > 0) onAdd(Array.from(files));
    if (input.current) input.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader title="Add sources" description="Upload PDFs to read and ask about." />
        <DialogBody className="flex flex-col gap-5">
          <div
            data-active={dragging || undefined}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragging(false);
              pick(e.dataTransfer.files);
            }}
            className={cn(
              "flex flex-col items-center gap-3 rounded-md border-2 border-dashed border-rule-strong px-6 py-8 text-center",
              "transition-colors duration-(--dur-fast) ease-out motion-reduce:transition-none",
              "data-active:border-primary data-active:drop-wash",
            )}
          >
            <Upload aria-hidden className="size-6 text-graphite" />
            <p className="text-body text-ink">Drag PDFs here</p>
            <Button variant="secondary" onClick={() => input.current?.click()}>
              Browse files
            </Button>
            <p className="text-small text-graphite">{HELPER}</p>
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-label="Choose PDF files"
              onChange={(e) => pick(e.target.files)}
            />
          </div>

          <Field
            label={
              <span className="flex items-center gap-2">
                Paste a link <Badge>Coming soon</Badge>
              </span>
            }
            helper="Links to papers and web pages are coming soon. Upload the PDF for now."
          >
            <Input disabled placeholder="https://arxiv.org/abs/…" />
          </Field>

          {rows.length > 0 && (
            <ul
              aria-label="Files"
              className="flex flex-col divide-y divide-rule rounded-md border border-rule"
            >
              {rows.map((item) => (
                <UploadRow
                  key={item.key}
                  item={item}
                  source={item.documentId ? byId.get(item.documentId) : undefined}
                  onOpenSource={(id) => {
                    onOpenSource(id);
                    onOpenChange(false);
                  }}
                />
              ))}
            </ul>
          )}
          <p className="sr-only" aria-live="polite" role="status">
            {announcement}
          </p>
        </DialogBody>
        <DialogFooter>
          {rows.some((r) => !isBusy(r)) && (
            <Button variant="ghost" onClick={() => getUploadManager().clearFinished(notebookId)}>
              Clear finished
            </Button>
          )}
          <DialogClose asChild>
            <Button>Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UploadRow({
  item,
  source,
  onOpenSource,
}: {
  item: UploadItem;
  source?: Source;
  onOpenSource: (id: string) => void;
}) {
  const status = uploadStatus(item, source);
  const manager = getUploadManager();
  const busy = isBusy(item);
  const says = status.line.toLowerCase().includes(status.word.toLowerCase());
  return (
    <li className="flex items-start gap-3 p-3" data-phase={item.phase}>
      <span
        aria-hidden
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted"
      >
        <FileText className="size-4 text-ink" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-body font-medium text-ink" title={item.name}>
            {middleTruncate(item.name, 36)}
          </span>
          <span className="shrink-0 text-small text-graphite tabular-nums">
            {formatBytes(item.size)}
          </span>
        </div>
        <StatusPill
          status={status.pill}
          className="max-w-full px-0"
          {...(says ? { label: status.line } : { detail: status.line })}
        />
        {status.progress !== null && busy && (
          <ProgressBar value={status.progress} label={`${item.name}: ${status.line}`} />
        )}
        {status.fix && <p className="text-small text-graphite">{status.fix}</p>}
        {status.actions && status.actions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {status.actions.map((action) => (
              <Button
                key={action.id}
                size="sm"
                variant={action.id === "add_anyway" ? "ghost" : "secondary"}
                onClick={() => {
                  if (action.id === "open_existing" && item.error?.existingId)
                    onOpenSource(item.error.existingId);
                  else if (action.id === "add_anyway") manager.addAnyway(item.key);
                  else manager.retry(item.key);
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      {busy ? (
        <IconButton
          icon={X}
          size="sm"
          aria-label={`Cancel upload of ${item.name}`}
          onClick={() => void manager.cancel(item.key)}
        />
      ) : (
        <IconButton
          icon={X}
          size="sm"
          aria-label={`Remove ${item.name} from the list`}
          onClick={() => manager.remove(item.key)}
        />
      )}
    </li>
  );
}

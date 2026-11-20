"use client";

import { Download, FilePlus2, MoreHorizontal, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { downloadOriginal } from "@/lib/documents/download";
import { sourceStatus } from "@/lib/documents/live";
import type { Source } from "@/lib/documents/shared";
import { getUploadManager } from "@/lib/uploads/browser";
import type { UploadItem } from "@/lib/uploads/manager";
import { SourceCard } from "./source-card";
import { uploadStatus } from "./upload-status";
import type { Connection } from "./use-live-sources";

export type SourceHandlers = {
  onSelect: (id: string) => void;
  onReprocess: (source: Source) => void;
  onDelete: (source: Source) => void;
  onCancelUpload: (source: Source) => void;
  onAddSource: () => void;
  onToggleIncluded?: (source: Source, included: boolean) => void;
};

/**
 * The 272px Sources panel: one card per source in upload order. Files this tab is still checking
 * or uploading appear at once, in their final place (no flying), before the server has a row.
 */
export function SourcesPanel({
  sources,
  uploads,
  selectedId,
  connection,
  ...handlers
}: SourceHandlers & {
  sources: Source[];
  uploads: UploadItem[];
  selectedId: string | null;
  connection: Connection;
}) {
  const ids = new Set(sources.map((s) => s.id));
  const uploadFor = new Map(uploads.filter((u) => u.documentId).map((u) => [u.documentId!, u]));
  // Local rows: not on the server yet (checking, waiting, failed before registering).
  const pending = uploads.filter(
    (u) => !u.documentId || (!ids.has(u.documentId) && u.phase !== "done"),
  );
  const count = sources.length;

  return (
    <aside aria-labelledby="sources-heading" className="flex min-w-0 flex-col gap-3">
      <header className="flex items-center justify-between gap-2">
        <h2 id="sources-heading" className="text-h3 text-ink">
          Sources <span className="text-graphite tabular-nums">{count > 0 ? count : ""}</span>
        </h2>
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={FilePlus2}
          onClick={handlers.onAddSource}
          aria-keyshortcuts="Control+U Meta+U"
        >
          Add source
        </Button>
      </header>
      {connection === "reconnecting" && (
        <p role="status" className="text-small text-graphite">
          Reconnecting… updates may be a few seconds late.
        </p>
      )}

      {count === 0 && pending.length === 0 ? (
        <div className="rounded-md border border-rule">
          <EmptyState
            titleAs="h3"
            icon={FilePlus2}
            title="Add your first source"
            description={
              <>
                Add a paper, notes or a dataset, then ask anything about it. Drop a PDF anywhere, or
                press <Kbd keys={["mod", "U"]} />.
              </>
            }
            action={{ label: "Add source", icon: FilePlus2, onClick: handlers.onAddSource }}
          />
        </div>
      ) : (
        <ul aria-label="Sources" className="flex flex-col gap-2">
          {sources.map((source) => {
            const upload = uploadFor.get(source.id);
            const percent =
              upload && source.stage === "uploading" && upload.size > 0
                ? (upload.sent / upload.size) * 100
                : undefined;
            const status =
              upload && source.stage === "uploading"
                ? uploadStatus(upload, source)
                : sourceStatus(source, percent);
            return (
              <li key={source.id}>
                <SourceCard
                  name={source.original_filename}
                  status={status}
                  selected={selectedId === source.id}
                  onSelect={() => handlers.onSelect(source.id)}
                  menu={<SourceMenu source={source} {...handlers} />}
                  actions={<FailedActions source={source} upload={upload} {...handlers} />}
                  include={
                    source.stage === "ready" && handlers.onToggleIncluded
                      ? { checked: source.included, onChange: (v) => handlers.onToggleIncluded?.(source, v) }
                      : undefined
                  }
                />
              </li>
            );
          })}
          {pending.map((item) => (
            <li key={item.key}>
              <SourceCard
                name={item.name}
                status={uploadStatus(item)}
                menu={
                  <IconButton
                    icon={X}
                    size="sm"
                    tooltip={false}
                    aria-label={
                      item.phase === "failed"
                        ? `Remove ${item.name} from the list`
                        : `Cancel upload of ${item.name}`
                    }
                    onClick={() =>
                      item.phase === "failed"
                        ? getUploadManager().remove(item.key)
                        : void getUploadManager().cancel(item.key)
                    }
                  />
                }
                actions={<PendingActions item={item} onSelect={handlers.onSelect} />}
              />
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function PendingActions({ item, onSelect }: { item: UploadItem; onSelect: (id: string) => void }) {
  const status = uploadStatus(item);
  if (!status.actions?.length) return null;
  const manager = getUploadManager();
  return (
    <>
      {status.actions.map((action) => (
        <Button
          key={action.id}
          size="sm"
          variant={action.id === "add_anyway" ? "ghost" : "secondary"}
          onClick={() => {
            if (action.id === "open_existing" && item.error?.existingId) {
              onSelect(item.error.existingId);
              manager.remove(item.key);
            } else if (action.id === "add_anyway") manager.addAnyway(item.key);
            else manager.retry(item.key);
          }}
        >
          {action.label}
        </Button>
      ))}
    </>
  );
}

function FailedActions({
  source,
  upload,
  onReprocess,
  onAddSource,
}: SourceHandlers & { source: Source; upload?: UploadItem }) {
  if (source.stage !== "failed") return null;
  const status = sourceStatus(source);
  if (!status.actions?.length) return null;
  return (
    <>
      {status.actions.map((action) => (
        <Button
          key={action.id}
          size="sm"
          variant="secondary"
          leadingIcon={RotateCcw}
          onClick={() => {
            if (action.id === "resume_upload") {
              // This tab still has the file: resume it. Otherwise choose it again.
              if (upload) getUploadManager().retry(upload.key);
              else onAddSource();
            } else onReprocess(source);
          }}
        >
          {action.label}
        </Button>
      ))}
    </>
  );
}

function SourceMenu({
  source,
  onReprocess,
  onDelete,
  onCancelUpload,
}: SourceHandlers & { source: Source }) {
  const uploading = source.stage === "uploading";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          icon={MoreHorizontal}
          size="sm"
          tooltip={false}
          aria-label={`Source options for ${source.original_filename}`}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {uploading ? (
          <DropdownMenuItem icon={X} onSelect={() => onCancelUpload(source)}>
            Cancel upload
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem icon={Download} onSelect={() => downloadOriginal(source.id)}>
              Download original
            </DropdownMenuItem>
            {(source.stage === "ready" || source.stage === "failed") && (
              <DropdownMenuItem icon={RotateCcw} onSelect={() => onReprocess(source)}>
                Read again
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={Trash2} destructive onSelect={() => onDelete(source)}>
              Delete source
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  boardColumns,
  NOTEBOOK_STATUSES,
  STATUS_LABELS,
  type Notebook,
  type NotebookStatus,
  type NotebookWithCounts,
} from "@/lib/notebooks/shared";
import { NotebookCard } from "./notebook-card";
import type { NotebookMenuHandlers } from "./notebook-menu";
import { STATUS_ICONS } from "./notebook-visuals";

type NotebooksBoardProps = NotebookMenuHandlers & {
  notebooks: NotebookWithCounts[];
  onAdd: (status: NotebookStatus) => void;
  renamingId?: string | null;
  onRenameDone?: (notebook: Notebook, title: string | null) => void;
};

/** Board: To read · Learning · Reviewing · Mastered, each in position order. */
export function NotebooksBoard({
  notebooks,
  onAdd,
  renamingId,
  onRenameDone,
  ...handlers
}: NotebooksBoardProps) {
  const columns = boardColumns(notebooks);
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {NOTEBOOK_STATUSES.map((status) => {
        const items = columns.get(status) ?? [];
        const Icon = STATUS_ICONS[status];
        const headingId = `board-${status}`;
        return (
          <section
            key={status}
            aria-labelledby={headingId}
            className="flex min-h-40 flex-col gap-3 rounded-md border border-rule bg-subtle p-3"
          >
            <header className="flex items-center gap-2 px-1">
              <Icon aria-hidden className="size-4 text-graphite" />
              <h2 id={headingId} className="text-h3 text-ink">
                {STATUS_LABELS[status]}
              </h2>
              <Badge aria-label={`${items.length} notebooks`}>{items.length}</Badge>
            </header>
            {items.length > 0 ? (
              <ol className="flex flex-col gap-2">
                {items.map((n) => (
                  <li key={n.id}>
                    <NotebookCard
                      notebook={n}
                      compact
                      renaming={renamingId === n.id}
                      onRenameDone={(title) => onRenameDone?.(n, title)}
                      {...handlers}
                    />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-1 text-small text-graphite">Drag notebooks here</p>
            )}
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={Plus}
              className="mt-auto justify-start text-graphite"
              onClick={() => onAdd(status)}
            >
              Add notebook
            </Button>
          </section>
        );
      })}
    </div>
  );
}

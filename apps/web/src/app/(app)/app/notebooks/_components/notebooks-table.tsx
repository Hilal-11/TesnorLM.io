"use client";

import { MoveRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, RelativeTime, type DataTableColumn } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NOTEBOOK_STATUSES,
  STATUS_LABELS,
  type NotebookStatus,
  type NotebookWithCounts,
} from "@/lib/notebooks/shared";
import { NotebookMenu, type NotebookMenuHandlers } from "./notebook-menu";
import { ColorDot, STATUS_ICONS, StatusWord, formatExamDate } from "./notebook-visuals";

const dash = <span className="text-graphite">—</span>;

type NotebooksTableProps = NotebookMenuHandlers & {
  notebooks: NotebookWithCounts[];
  emptyState: ReactNode;
  onBulkMove: (ids: string[], status: NotebookStatus) => void;
  onBulkDelete: (ids: string[]) => void;
};

/** List view: sortable columns, selection with bulk Move to… and Delete (Undo). */
export function NotebooksTable({
  notebooks,
  emptyState,
  onBulkMove,
  onBulkDelete,
  ...handlers
}: NotebooksTableProps) {
  const columns = useMemo<DataTableColumn<NotebookWithCounts>[]>(
    () => [
      {
        id: "name",
        accessorKey: "title",
        header: "Name",
        cell: ({ row }) => (
          <span className="flex min-w-0 items-center gap-2">
            <ColorDot color={row.original.color} />
            <Link
              href={`/app/notebooks/${row.original.id}`}
              className="truncate link-underline font-medium text-ink"
            >
              {row.original.title}
            </Link>
          </span>
        ),
      },
      {
        id: "subject",
        accessorKey: "subject",
        header: "Subject",
        meta: { priority: "low" },
        cell: ({ row }) => row.original.subject ?? dash,
      },
      {
        id: "status",
        accessorFn: (n) => NOTEBOOK_STATUSES.indexOf(n.status),
        header: "Status",
        cell: ({ row }) => <StatusWord status={row.original.status} className="text-body" />,
      },
      {
        id: "sources",
        accessorKey: "source_count",
        header: "Sources",
        meta: { align: "right" },
        cell: ({ row }) => row.original.source_count,
      },
      {
        id: "exam",
        accessorFn: (n) => n.exam_date ?? "9999-12-31",
        header: "Exam date",
        meta: { priority: "low" },
        cell: ({ row }) => (row.original.exam_date ? formatExamDate(row.original.exam_date) : dash),
      },
      {
        id: "opened",
        accessorFn: (n) => (n.last_opened_at ? Date.parse(n.last_opened_at) : 0),
        header: "Last opened",
        meta: { priority: "low" },
        cell: ({ row }) =>
          row.original.last_opened_at ? (
            <RelativeTime date={new Date(row.original.last_opened_at)} />
          ) : (
            <span className="text-graphite">Never</span>
          ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => <NotebookMenu notebook={row.original} {...handlers} />,
      },
    ],
    [handlers],
  );

  return (
    <DataTable
      caption="Notebooks"
      columns={columns}
      data={notebooks}
      getRowId={(n) => n.id}
      selectable
      cardTitleColumn="name"
      emptyState={emptyState}
      bulkActions={(ids, clear) => (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" leadingIcon={MoveRight}>
                Move to…
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {NOTEBOOK_STATUSES.map((status) => (
                <DropdownMenuItem
                  key={status}
                  icon={STATUS_ICONS[status]}
                  onSelect={() => {
                    onBulkMove(ids, status);
                    clear();
                  }}
                >
                  {STATUS_LABELS[status]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={Trash2}
            onClick={() => {
              onBulkDelete(ids);
              clear();
            }}
          >
            Delete
          </Button>
        </>
      )}
    />
  );
}

"use client";

import {
  FileSpreadsheet,
  FileText,
  FileType,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, RelativeTime, type DataTableColumn } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Pagination } from "@/components/ui/pagination";
import { StatusPill, type DocumentStatus } from "@/components/ui/status-pill";
import { toast } from "@/components/ui/toast";
import { Demo, ShowcaseSection } from "../showcase";

type Doc = {
  id: string;
  name: string;
  status: DocumentStatus;
  pages: number | null;
  added: Date;
  durationSec: number | null;
};

// Fixed "now" so server and client render the same relative times.
const NOW = new Date("2026-11-19T10:00:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

const DOCS: Doc[] = [
  {
    id: "1",
    name: "attention-is-all-you-need.pdf",
    status: "ready",
    pages: 15,
    added: ago(120),
    durationSec: 42,
  },
  { id: "2", name: "bert.pdf", status: "indexing", pages: 16, added: ago(8), durationSec: null },
  { id: "3", name: "resnet.pdf", status: "ready", pages: 12, added: ago(60 * 26), durationSec: 31 },
  {
    id: "4",
    name: "scan-notes.pdf",
    status: "failed",
    pages: null,
    added: ago(45),
    durationSec: 9,
  },
  { id: "5", name: "gpt-3.pdf", status: "reading", pages: 75, added: ago(3), durationSec: null },
  {
    id: "6",
    name: "lecture-04.docx",
    status: "queued",
    pages: null,
    added: ago(1),
    durationSec: null,
  },
  {
    id: "7",
    name: "results.csv",
    status: "ready",
    pages: null,
    added: ago(60 * 24 * 9),
    durationSec: 4,
  },
];

function FileIcon({ name }: { name: string }) {
  const Icon = name.endsWith(".csv")
    ? FileSpreadsheet
    : name.endsWith(".docx")
      ? FileType
      : FileText;
  return <Icon aria-hidden className="size-4 shrink-0 text-graphite" />;
}

function RowActions({ doc }: { doc: Doc }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          icon={MoreHorizontal}
          aria-label={`More actions for ${doc.name}`}
          size="sm"
          tooltip={false}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem icon={RefreshCw}>Re-process</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          icon={Trash2}
          destructive
          onSelect={() =>
            toast.success("Source deleted", { action: { label: "Undo", onClick: () => {} } })
          }
        >
          Delete source
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const DOC_COLUMNS: DataTableColumn<Doc>[] = [
  {
    id: "name",
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <span className="flex min-w-0 items-center gap-2">
        <FileIcon name={row.original.name} />
        <span className="truncate font-medium">{row.original.name}</span>
      </span>
    ),
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusPill status={row.original.status} className="-ml-1" />,
  },
  {
    id: "pages",
    accessorKey: "pages",
    header: "Pages",
    meta: { align: "right" },
    cell: ({ row }) => row.original.pages ?? <span className="text-graphite">—</span>,
  },
  {
    id: "added",
    accessorKey: "added",
    header: "Added",
    sortFn: "datetime",
    meta: { priority: "low" },
    cell: ({ row }) => <RelativeTime date={row.original.added} now={NOW} />,
  },
  {
    id: "duration",
    accessorKey: "durationSec",
    header: "Duration",
    meta: { align: "right", priority: "low" },
    cell: ({ row }) =>
      row.original.durationSec === null ? (
        <span className="text-graphite">—</span>
      ) : (
        `${row.original.durationSec}s`
      ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    enableSorting: false,
    meta: { align: "right" },
    cell: ({ row }) => <RowActions doc={row.original} />,
  },
];

export function DataSection() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const docs = useMemo(() => DOCS, []);

  return (
    <ShowcaseSection
      id="data"
      title="Data"
      usage="Tables for many items you compare or act on in bulk. Numbers align right in tabular figures; dates read as relative time with the exact time on hover. Under 768px rows become cards."
    >
      <Demo
        title="Processing and activity"
        note="Sort the headers, select rows (Shift+click for a range), try the bulk actions."
      >
        <div className="flex flex-col gap-4">
          <DataTable
            caption="Sources and their processing status"
            columns={DOC_COLUMNS}
            data={docs}
            getRowId={(d) => d.id}
            selectable
            defaultSelectedIds={["2", "5"]}
            cardTitleColumn="name"
            bulkActions={(ids, clear) => (
              <>
                <Button variant="secondary" size="sm" leadingIcon={RefreshCw} onClick={clear}>
                  Re-process
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={Trash2}
                  onClick={() => {
                    toast.success(
                      ids.length === 1 ? "Source deleted" : `${ids.length} sources deleted`,
                      {
                        action: { label: "Undo", onClick: () => {} },
                      },
                    );
                    clear();
                  }}
                >
                  Delete
                </Button>
              </>
            )}
          />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={134}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      </Demo>

      <Demo title="Loading" note="Five skeleton rows, shown after 300ms.">
        <DataTable
          caption="Sources (loading)"
          columns={DOC_COLUMNS}
          data={[]}
          getRowId={(d) => d.id}
          loading
        />
      </Demo>

      <Demo title="Empty">
        <DataTable
          caption="Sources (empty)"
          columns={DOC_COLUMNS}
          data={[]}
          getRowId={(d) => d.id}
          emptyState={
            <EmptyState
              icon={Upload}
              title="No sources yet"
              description="Add a paper, notes or a dataset to see it processed here."
              action={{ label: "Add source", icon: Upload }}
            />
          }
        />
      </Demo>

      <Demo title="Error">
        <DataTable
          caption="Sources (error)"
          columns={DOC_COLUMNS}
          data={[]}
          getRowId={(d) => d.id}
          error="Couldn't load your sources. Check your connection, then try again."
          onRetry={() => toast.info("Trying again…")}
        />
      </Demo>
    </ShowcaseSection>
  );
}

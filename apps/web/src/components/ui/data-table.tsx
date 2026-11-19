"use client";

import {
  createSortedRowModel,
  flexRender,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, CircleAlert, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DelayedSkeleton, SkeletonTableRow } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type DataColumnMeta = {
  /** Numbers align right with tabular figures. */
  align?: "left" | "right";
  /** Hidden in the stacked mobile cards (< 768px). */
  priority?: "low";
};

export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowSelectionFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  columnMeta: {} as DataColumnMeta,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- column values differ per column
export type DataTableColumn<T extends RowData> = ColumnDef<typeof dataTableFeatures, T, any>;

type DataTableProps<T extends RowData> = {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  /** Accessible name for the table. */
  caption: string;
  loading?: boolean;
  /** Shows an inline danger row with "Try again". */
  error?: string;
  onRetry?: () => void;
  emptyState?: ReactNode;
  selectable?: boolean;
  /** Rows selected on first render. */
  defaultSelectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Buttons shown next to the "N selected" chip. */
  bulkActions?: (ids: string[], clearSelection: () => void) => ReactNode;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  /** Column shown as the title of each stacked card on mobile. */
  cardTitleColumn?: string;
};

const ARIA_SORT = { asc: "ascending", desc: "descending" } as const;

export function DataTable<T extends RowData>({
  columns,
  data,
  getRowId,
  caption,
  loading = false,
  error,
  onRetry,
  emptyState,
  selectable = false,
  defaultSelectedIds = [],
  onSelectionChange,
  bulkActions,
  sorting: sortingProp,
  onSortingChange,
  cardTitleColumn,
}: DataTableProps<T>) {
  const [innerSorting, setInnerSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(() =>
    Object.fromEntries(defaultSelectedIds.map((id) => [id, true])),
  );
  const sorting = sortingProp ?? innerSorting;
  const lastToggled = useRef<number | null>(null);
  const shiftHeld = useRef(false);

  const updateSelection = (next: RowSelectionState) => {
    setRowSelection(next);
    onSelectionChange?.(Object.keys(next).filter((id) => next[id]));
  };

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: (row) => getRowId(row),
    state: { sorting, rowSelection },
    sortDescFirst: false,
    enableRowSelection: selectable,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      if (sortingProp === undefined) setInnerSorting(next);
      onSortingChange?.(next);
    },
    onRowSelectionChange: (updater) =>
      updateSelection(typeof updater === "function" ? updater(rowSelection) : updater),
  });

  const rows = table.getRowModel().rows;
  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const clearSelection = () => updateSelection({});
  const visibleColumns = columns.length + (selectable ? 1 : 0);

  function toggleRow(index: number, checked: boolean) {
    const next = { ...rowSelection };
    const from = shiftHeld.current && lastToggled.current !== null ? lastToggled.current : index;
    const [a, b] = from < index ? [from, index] : [index, from];
    for (let i = a; i <= b; i++) {
      const id = rows[i].id;
      if (checked) next[id] = true;
      else delete next[id];
    }
    lastToggled.current = index;
    updateSelection(next);
  }

  const allSelected = rows.length > 0 && rows.every((r) => rowSelection[r.id]);
  const someSelected = !allSelected && rows.some((r) => rowSelection[r.id]);
  const headerCheckbox = (
    <Checkbox
      aria-label="Select all rows"
      checked={allSelected ? true : someSelected ? "indeterminate" : false}
      onCheckedChange={() =>
        updateSelection(allSelected ? {} : Object.fromEntries(rows.map((r) => [r.id, true])))
      }
    />
  );

  const rowCheckbox = (index: number, id: string, label: string) => (
    <Checkbox
      aria-label={`Select ${label}`}
      checked={Boolean(rowSelection[id])}
      onClick={(e) => {
        shiftHeld.current = e.shiftKey;
      }}
      onCheckedChange={(checked) => toggleRow(index, checked === true)}
    />
  );

  const rowLabel = (index: number) => {
    const row = rows[index];
    const titleCell = row
      .getAllCells()
      .find((c) => c.column.id === (cardTitleColumn ?? columns[0]?.id));
    return String(titleCell?.getValue() ?? row.id);
  };

  const status = loading ? "loading" : error ? "error" : rows.length === 0 ? "empty" : "rows";

  return (
    <div data-slot="data-table" className="flex flex-col gap-3">
      {selectable && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-8 items-center gap-1 rounded-sm bg-accent pr-1 pl-3 text-small font-medium text-primary tabular-nums">
            {selectedIds.length} selected
            <button
              type="button"
              aria-label="Clear selection"
              onClick={clearSelection}
              className="inline-flex size-6 cursor-pointer items-center justify-center rounded-xs interactive hover:bg-primary/12 active:scale-94"
            >
              <X aria-hidden className="size-4" />
            </button>
          </span>
          {bulkActions?.(selectedIds, clearSelection)}
        </div>
      )}

      <div className="overflow-clip rounded-md border border-rule bg-sheet">
        <table className="hidden w-full border-collapse md:table">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-sheet">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {selectable && (
                  <th scope="col" className="h-10 w-12 border-b border-rule pl-4">
                    {headerCheckbox}
                  </th>
                )}
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  const label = flexRender(header.column.columnDef.header, header.getContext());
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={canSort ? (sorted ? ARIA_SORT[sorted] : "none") : undefined}
                      className={cn(
                        "h-10 border-b border-rule px-4 text-small font-medium whitespace-nowrap text-graphite",
                        meta?.align === "right" ? "text-right" : "text-left",
                      )}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "-mx-2 inline-flex h-8 cursor-pointer items-center gap-1 rounded-sm px-2 interactive hover:bg-accent/50 hover:text-ink",
                            sorted && "text-ink",
                          )}
                        >
                          {label}
                          {sorted === "asc" ? (
                            <ArrowUp aria-hidden className="size-3.5" />
                          ) : sorted === "desc" ? (
                            <ArrowDown aria-hidden className="size-3.5" />
                          ) : (
                            <ArrowUpDown aria-hidden className="size-3.5 opacity-60" />
                          )}
                        </button>
                      ) : (
                        label
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {status === "error" && (
              <tr>
                <td colSpan={visibleColumns} className="px-4 py-4">
                  <ErrorRow message={error!} onRetry={onRetry} />
                </td>
              </tr>
            )}
            {status === "rows" &&
              rows.map((row, index) => (
                <tr
                  key={row.id}
                  data-selected={rowSelection[row.id] ? true : undefined}
                  className="h-12 border-b border-rule last:border-b-0 hover:bg-accent/40 data-selected:bg-accent"
                >
                  {selectable && (
                    <td className="w-12 pl-4">{rowCheckbox(index, row.id, rowLabel(index))}</td>
                  )}
                  {row.getAllCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-4 text-body text-ink",
                          meta?.align === "right" && "text-right tabular-nums",
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>

        {/* Under 768px rows become stacked cards; low-priority columns hide. */}
        {status === "rows" && (
          <ul aria-label={caption} className="divide-y divide-rule md:hidden">
            {rows.map((row, index) => (
              <li
                key={row.id}
                data-selected={rowSelection[row.id] ? true : undefined}
                className="flex gap-3 p-4 data-selected:bg-accent"
              >
                {selectable && (
                  <div className="pt-1">{rowCheckbox(index, row.id, rowLabel(index))}</div>
                )}
                <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  {row
                    .getAllCells()
                    .filter((cell) => cell.column.columnDef.meta?.priority !== "low")
                    .map((cell) => (
                      <div key={cell.id} className="contents">
                        <dt className="text-small text-graphite">
                          {typeof cell.column.columnDef.header === "string"
                            ? cell.column.columnDef.header
                            : ""}
                        </dt>
                        <dd className="min-w-0 truncate text-body text-ink">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </dd>
                      </div>
                    ))}
                </dl>
              </li>
            ))}
          </ul>
        )}
        {status === "error" && (
          <div className="p-4 md:hidden">
            <ErrorRow message={error!} onRetry={onRetry} />
          </div>
        )}
        {status === "loading" && (
          <DelayedSkeleton label="Loading rows">
            {Array.from({ length: 5 }, (_, i) => (
              <SkeletonTableRow key={i} columns={Math.min(columns.length, 5)} />
            ))}
          </DelayedSkeleton>
        )}
        {status === "empty" && emptyState}
      </div>
    </div>
  );
}

function ErrorRow({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 text-body text-danger-strong">
      <CircleAlert aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

export function formatRelative(date: Date, now: Date = new Date()) {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

/** "2 hours ago", with the exact time in a tooltip and the datetime attribute. */
export function RelativeTime({ date, now }: { date: Date; now?: Date }) {
  const exact = date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  return (
    <Tooltip label={exact}>
      <time dateTime={date.toISOString()} suppressHydrationWarning className="cursor-default">
        {formatRelative(date, now)}
      </time>
    </Tooltip>
  );
}

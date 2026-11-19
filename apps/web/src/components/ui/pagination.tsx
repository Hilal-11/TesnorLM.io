"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Page numbers with ellipses: first, last, and the current page ± 1. */
export function getPageItems(page: number, pageCount: number): (number | "ellipsis")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const items: (number | "ellipsis")[] = [1];
  const start = Math.max(2, Math.min(page - 1, pageCount - 4));
  const end = Math.min(pageCount - 1, Math.max(page + 1, 5));
  if (start > 2) items.push("ellipsis");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < pageCount - 1) items.push("ellipsis");
  items.push(pageCount);
  return items;
}

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizes?: number[];
  className?: string;
};

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = [10, 20, 50],
  className,
}: PaginationProps) {
  const sizeId = useId();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex flex-wrap items-center justify-between gap-4", className)}
    >
      <p className="text-small text-graphite tabular-nums">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={ChevronLeft}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="px-2 text-small text-graphite tabular-nums sm:hidden">
          Page {page} of {pageCount}
        </span>
        <ul className="hidden items-center gap-1 sm:flex">
          {getPageItems(page, pageCount).map((item, i) =>
            item === "ellipsis" ? (
              <li key={`e${i}`} aria-hidden className="w-6 text-center text-small text-graphite">
                …
              </li>
            ) : (
              <li key={item}>
                <button
                  type="button"
                  aria-label={`Page ${item}`}
                  aria-current={item === page ? "page" : undefined}
                  onClick={() => onPageChange(item)}
                  className="size-8 cursor-pointer rounded-sm text-small text-ink tabular-nums interactive hover:bg-accent/50 active:scale-94 aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-primary"
                >
                  {item}
                </button>
              </li>
            ),
          )}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          trailingIcon={ChevronRight}
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
      {onPageSizeChange && (
        <div className="flex items-center gap-2">
          <label htmlFor={sizeId} className="text-small text-graphite">
            Rows per page
          </label>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger id={sizeId} className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizes.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </nav>
  );
}

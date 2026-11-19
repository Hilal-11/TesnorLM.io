"use client";

import { ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type BreadcrumbSegment = {
  label: string;
  /** e.g. <Badge variant="primary">Pro</Badge> */
  badge?: ReactNode;
  /** Status dot + word, e.g. { word: "Student level", tone: "success" }. */
  status?: { word: string; tone?: "primary" | "success" | "warning" };
  /** Switch to a sibling (workspace / notebook / level). */
  options?: { value: string; label: string }[];
  menuLabel?: string;
  value?: string;
  onSelect?: (value: string) => void;
};

const DOT = { primary: "bg-primary", success: "bg-success", warning: "bg-warning" };

function SegmentContent({ segment }: { segment: BreadcrumbSegment }) {
  return (
    <>
      <span className="min-w-0 truncate">{segment.label}</span>
      {segment.badge}
      {segment.status && (
        <span className="flex shrink-0 items-center gap-1 text-small font-normal text-graphite">
          <span
            aria-hidden
            className={cn("size-2 rounded-full", DOT[segment.status.tone ?? "primary"])}
          />
          {segment.status.word}
        </span>
      )}
    </>
  );
}

/** Workspace / notebook / level path where each segment can switch. The last is the current page. */
export function BreadcrumbSwitcher({
  segments,
  className,
}: {
  segments: BreadcrumbSegment[];
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1">
        {segments.map((segment, i) => {
          const current = i === segments.length - 1;
          const middle = i > 0 && !current;
          const segmentClass = cn(
            "interactive flex h-8 min-w-0 items-center gap-2 rounded-sm px-2 text-body font-medium text-ink",
            current ? "shrink-0" : "text-graphite",
            middle && "max-md:max-w-28",
          );
          return (
            <li
              key={`${segment.label}-${i}`}
              className={cn("flex min-w-0 items-center gap-1", current && "shrink-0")}
            >
              {i > 0 && (
                <span aria-hidden className="text-graphite">
                  /
                </span>
              )}
              {segment.options ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        segmentClass,
                        "cursor-pointer hover:bg-accent/50 active:scale-98",
                      )}
                    >
                      <SegmentContent segment={segment} />
                      <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 text-graphite" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {segment.menuLabel && (
                      <DropdownMenuLabel>{segment.menuLabel}</DropdownMenuLabel>
                    )}
                    <DropdownMenuRadioGroup value={segment.value} onValueChange={segment.onSelect}>
                      {segment.options.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span aria-current={current ? "page" : undefined} className={segmentClass}>
                  <SegmentContent segment={segment} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Muted block with a slow 1.6s sheen (static under reduced motion). */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("sheen rounded-sm bg-muted", className)}
      {...props}
    />
  );
}

/**
 * Shows its skeleton only after `delay` ms (300 by default), so fast loads never flash one
 * (skill 10.6). Announces "Loading" to screen readers immediately.
 */
export function DelayedSkeleton({
  delay = 300,
  label = "Loading",
  children,
}: {
  delay?: number;
  label?: string;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  return (
    <div role="status" aria-busy="true" data-visible={visible}>
      <span className="sr-only">{label}</span>
      {visible && children}
    </div>
  );
}

const LINE_WIDTHS = ["w-full", "w-11/12", "w-4/5", "w-full", "w-3/5"];

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", i === lines - 1 ? "w-3/5" : LINE_WIDTHS[i % LINE_WIDTHS.length])}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatarLines({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Skeleton className="size-8 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/** Matches a source card: file icon, name, status line. */
export function SkeletonSourceCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border border-rule bg-sheet p-3",
        className,
      )}
    >
      <Skeleton className="size-8 rounded-sm" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

/** Matches an answer: reading-width lines at Literata line height. */
export function SkeletonMessage({ className }: { className?: string }) {
  return (
    <div className={cn("flex measure flex-col gap-3", className)}>
      <Skeleton className="h-4 w-2/5" />
      <SkeletonText lines={4} />
    </div>
  );
}

export function SkeletonTableRow({
  columns = 4,
  className,
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex h-12 items-center gap-6 border-b border-rule px-4", className)}>
      <Skeleton className="size-4 rounded-xs" />
      {Array.from({ length: columns }, (_, i) => (
        <Skeleton key={i} className={cn("h-3", i === 0 ? "flex-2" : "flex-1")} />
      ))}
    </div>
  );
}

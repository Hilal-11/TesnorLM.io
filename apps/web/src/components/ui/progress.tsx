"use client";

import { Progress as ProgressPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

type ProgressBarProps = {
  /** 0–max. Omit for an indeterminate bar (slow sheen; static under reduced motion). */
  value?: number | null;
  max?: number;
  size?: 4 | 6;
  label: string;
  className?: string;
};

export function ProgressBar({ value, max = 100, size = 4, label, className }: ProgressBarProps) {
  const indeterminate = value === undefined || value === null;
  const pct = indeterminate ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <ProgressPrimitive.Root
      data-slot="progress-bar"
      value={indeterminate ? null : value}
      max={max}
      aria-label={label}
      className={cn(
        "relative w-full overflow-hidden rounded-full bg-rule",
        size === 6 ? "h-1.5" : "h-1",
        className,
      )}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full rounded-full bg-cobalt",
          indeterminate
            ? "w-2/5 animate-indeterminate motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-40"
            : "w-full transition-transform duration-(--dur-slow) ease-out",
        )}
        style={indeterminate ? undefined : { transform: `translateX(-${100 - pct}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

/** Steps: done = cobalt, current = cobalt ring, to do = rule. Labelled "Step 2 of 5". */
export function ProgressDots({
  steps,
  current,
  className,
}: {
  steps: number;
  current: number;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={`Step ${current} of ${steps}`}
      className={cn("flex items-center gap-2", className)}
    >
      {Array.from({ length: steps }, (_, i) => {
        const step = i + 1;
        return (
          <span
            key={step}
            data-state={step < current ? "done" : step === current ? "current" : "todo"}
            className={cn(
              "size-2 rounded-full",
              step < current && "bg-cobalt",
              step === current && "ring-2 ring-cobalt",
              step > current && "bg-rule-strong",
            )}
          />
        );
      })}
    </div>
  );
}

const RING = {
  32: { stroke: 3, text: "text-[0.625rem]" },
  48: { stroke: 4, text: "text-small" },
  64: { stroke: 4, text: "text-body" },
} as const;

/** Circular progress with the value in tabular numbers. */
export function ProgressRing({
  value,
  size = 48,
  label,
  className,
}: {
  value: number;
  size?: keyof typeof RING;
  label: string;
  className?: string;
}) {
  const pct = Math.round(Math.min(100, Math.max(0, value)));
  const { stroke, text } = RING[size];
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-rule"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          className="stroke-cobalt transition-[stroke-dashoffset] duration-(--dur-slow) ease-out"
        />
      </svg>
      <span aria-hidden className={cn("absolute font-medium text-ink tabular-nums", text)}>
        {pct}%
      </span>
    </div>
  );
}

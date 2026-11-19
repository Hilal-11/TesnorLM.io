"use client";

import type { LucideIcon } from "lucide-react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type SegmentOption = { value: string; label: string; icon?: LucideIcon };

type SegmentedControlProps = {
  options: SegmentOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  "aria-label": string;
  className?: string;
};

/**
 * One choice from a few (Light · Dark · System). Equal-width segments; the selected background
 * slides with transform (--dur-base, --ease-out). Arrow keys move between segments.
 */
export function SegmentedControl({
  options,
  value,
  defaultValue,
  onValueChange,
  "aria-label": ariaLabel,
  className,
}: SegmentedControlProps) {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = value ?? inner;
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === current),
  );

  return (
    <ToggleGroupPrimitive.Root
      type="single"
      aria-label={ariaLabel}
      value={current}
      onValueChange={(next) => {
        if (!next) return; // a segmented control always keeps one choice
        setInner(next);
        onValueChange?.(next);
      }}
      className={cn("relative inline-grid rounded-sm bg-muted p-0.5", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute top-0.5 bottom-0.5 left-0.5 rounded-[6px] bg-sheet-2 shadow-1 ring-1 ring-rule transition-transform duration-(--dur-base) ease-out"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map(({ value: v, label, icon: Icon }) => (
        <ToggleGroupPrimitive.Item
          key={v}
          value={v}
          className="relative flex h-8 cursor-pointer items-center justify-center gap-2 rounded-[6px] px-3 text-small font-medium whitespace-nowrap text-graphite interactive hover:text-ink data-[state=on]:text-ink [&_svg]:size-4"
        >
          {Icon && <Icon aria-hidden />}
          {label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}

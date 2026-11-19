"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const tagBase =
  "inline-flex h-6 max-w-full items-center gap-1 rounded-xs bg-muted px-2 text-small font-medium text-ink";

type TagProps = React.ComponentProps<"span"> & {
  /** Adds a remove button named "Remove <tag>". */
  onRemove?: () => void;
};

/** A small r-xs chip for topics, filters and multi-select values. */
export function Tag({ className, children, onRemove, ...props }: TagProps) {
  const label = typeof children === "string" ? children : "tag";
  return (
    <span data-slot="tag" className={cn(tagBase, onRemove && "pr-0.5", className)} {...props}>
      <span className="truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-xs text-graphite interactive hover:bg-cobalt-soft hover:text-ink active:scale-94"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      )}
    </span>
  );
}

type SelectableTagProps = Omit<React.ComponentProps<"button">, "onChange"> & {
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
};

/** A filter chip that toggles (aria-pressed). */
export function SelectableTag({
  className,
  selected,
  onSelectedChange,
  ...props
}: SelectableTagProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelectedChange(!selected)}
      className={cn(
        tagBase,
        "cursor-pointer interactive hover:bg-cobalt-soft/60 active:scale-98 aria-pressed:bg-cobalt-soft aria-pressed:text-cobalt",
        className,
      )}
      {...props}
    />
  );
}

"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { fieldBox, useFieldControl } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

/** The bare <input> inside a field box. */
export const inputElement =
  "h-full min-w-0 flex-1 bg-transparent px-3 text-inherit outline-none placeholder:text-graphite disabled:cursor-not-allowed";

export type InputProps = Omit<React.ComponentProps<"input">, "prefix" | "size"> & {
  size?: "md" | "lg";
  /** Muted segment before the text, e.g. "https://". */
  prefix?: ReactNode;
  /** Icon or <Kbd> after the text. */
  suffix?: ReactNode;
  /** Shows a "Clear" button while there is a value (controlled inputs). */
  onClear?: () => void;
  "data-force"?: string;
};

export function Input({
  className,
  size,
  prefix,
  suffix,
  onClear,
  "data-force": force,
  ...props
}: InputProps) {
  const field = useFieldControl(props);
  const hasValue = props.value !== undefined && String(props.value) !== "";

  return (
    <div data-slot="input" data-force={force} className={cn(fieldBox({ size }), className)}>
      {prefix && (
        <span className="flex h-full shrink-0 items-center rounded-l-[7px] border-r border-rule bg-muted px-3 text-graphite">
          {prefix}
        </span>
      )}
      <input {...props} {...field} className={inputElement} />
      {onClear && hasValue && !field.disabled && (
        <IconButton icon={X} aria-label="Clear" size="sm" className="mr-0.5" onClick={onClear} />
      )}
      {suffix && (
        <span className="flex shrink-0 items-center pr-3 text-graphite [&_svg]:size-4">
          {suffix}
        </span>
      )}
    </div>
  );
}

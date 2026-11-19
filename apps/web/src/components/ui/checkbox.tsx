"use client";

import { Check, Minus } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 16px r-xs box; checked and indeterminate fill primary. */
export function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root> & { "data-force"?: string }) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "group inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-xs border border-graphite bg-sheet text-primary-foreground interactive hover:border-ink disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        <Check
          aria-hidden
          strokeWidth={3}
          className="size-3 group-data-[state=indeterminate]:hidden"
        />
        <Minus
          aria-hidden
          strokeWidth={3}
          className="hidden size-3 group-data-[state=indeterminate]:block"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

type CheckboxFieldProps = React.ComponentProps<typeof CheckboxPrimitive.Root> & {
  label: ReactNode;
  description?: ReactNode;
  "data-force"?: string;
};

/** Checkbox with a label and optional description; the whole row is clickable. */
export function CheckboxField({ label, description, id, className, ...props }: CheckboxFieldProps) {
  const autoId = useId();
  const checkboxId = id ?? autoId;
  const descriptionId = description ? `${checkboxId}-description` : undefined;
  return (
    <label
      htmlFor={checkboxId}
      className={cn(
        "flex cursor-pointer items-start gap-3 py-1 has-disabled:cursor-not-allowed has-disabled:opacity-50",
        className,
      )}
    >
      <Checkbox id={checkboxId} aria-describedby={descriptionId} className="mt-1" {...props} />
      <span className="flex min-w-0 flex-col">
        <span className="text-body text-ink">{label}</span>
        {description && (
          <span id={descriptionId} aria-hidden className="text-small text-graphite">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

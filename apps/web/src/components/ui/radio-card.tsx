"use client";

import { Check, type LucideIcon } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function RadioCardGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-card-group"
      className={cn("grid gap-3 sm:grid-cols-3", className)}
      {...props}
    />
  );
}

type RadioCardProps = Omit<React.ComponentProps<typeof RadioGroupPrimitive.Item>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  "data-force"?: string;
};

/** A selectable r-md card. Selected: 2px cobalt edge, cobalt-soft fill, check. Arrow keys move. */
export function RadioCard({ title, description, icon: Icon, className, ...props }: RadioCardProps) {
  const id = useId();
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-card"
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      className={cn(
        "group relative flex cursor-pointer flex-col items-start gap-2 rounded-md border border-rule bg-sheet p-4 pr-12 text-left interactive hover:border-rule-strong disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-cobalt data-[state=checked]:bg-cobalt-soft data-[state=checked]:ring-1 data-[state=checked]:ring-cobalt data-[state=checked]:ring-inset",
        className,
      )}
      {...props}
    >
      {Icon && (
        <Icon aria-hidden className="size-5 text-graphite group-data-[state=checked]:text-cobalt" />
      )}
      <span id={`${id}-title`} className="text-body font-medium text-ink">
        {title}
      </span>
      {description && (
        <span id={`${id}-description`} className="text-small text-graphite">
          {description}
        </span>
      )}
      <span
        aria-hidden
        className="absolute top-4 right-4 flex size-5 items-center justify-center rounded-full border border-graphite group-data-[state=checked]:border-cobalt group-data-[state=checked]:bg-cobalt"
      >
        <Check
          strokeWidth={3}
          className="size-3 text-primary-foreground opacity-0 group-data-[state=checked]:opacity-100"
        />
      </span>
    </RadioGroupPrimitive.Item>
  );
}

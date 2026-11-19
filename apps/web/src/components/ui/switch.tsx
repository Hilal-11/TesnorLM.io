"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 36×20 toggle; on = primary; the thumb slides with --spring (skill 8.1). */
export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & { "data-force"?: string }) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-graphite/80 p-0.5 interactive hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:hover:bg-primary/85",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-full bg-sheet shadow-1 transition-transform duration-(--dur-base) ease-spring data-[state=checked]:translate-x-4" />
    </SwitchPrimitive.Root>
  );
}

type SwitchFieldProps = React.ComponentProps<typeof SwitchPrimitive.Root> & {
  label: ReactNode;
  description?: ReactNode;
  /** e.g. <Badge>Recommended</Badge> */
  badge?: ReactNode;
  /** Show "On" / "Off" next to the switch. */
  showState?: boolean;
  "data-force"?: string;
};

export function SwitchField({
  label,
  description,
  badge,
  showState,
  id,
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  ...props
}: SwitchFieldProps) {
  const autoId = useId();
  const switchId = id ?? autoId;
  const [inner, setInner] = useState(defaultChecked ?? false);
  const on = checked ?? inner;
  const descriptionId = description ? `${switchId}-description` : undefined;

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Switch
        id={switchId}
        checked={on}
        onCheckedChange={(next) => {
          setInner(next);
          onCheckedChange?.(next);
        }}
        aria-describedby={descriptionId}
        className="mt-0.5"
        {...props}
      />
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={switchId} className="cursor-pointer text-body font-medium text-ink">
            {label}
          </label>
          {showState && (
            <span aria-hidden className="text-small text-graphite">
              {on ? "On" : "Off"}
            </span>
          )}
          {badge}
        </div>
        {description && (
          <p id={descriptionId} className="text-small text-graphite">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

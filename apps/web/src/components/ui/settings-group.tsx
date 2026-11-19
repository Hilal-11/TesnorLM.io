"use client";

import { Lock } from "lucide-react";
import { useCallback, useId, useState, type ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/** A well (muted in light, sheet in dark) holding one card whose rows are divided by rules. */
export function SettingsGroup({
  title,
  description,
  className,
  children,
}: {
  title?: string;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={title ? id : undefined}
      className={cn("flex flex-col gap-3", className)}
    >
      {(title || description) && (
        <div className="flex flex-col gap-1 px-1">
          {title && (
            <h3 id={id} className="text-h3 text-ink">
              {title}
            </h3>
          )}
          {description && <p className="text-small text-graphite">{description}</p>}
        </div>
      )}
      <div className="rounded-lg bg-well p-1">
        <div className="divide-y divide-rule rounded-md border border-rule bg-sheet">
          {children}
        </div>
      </div>
    </div>
  );
}

type SettingsRowProps = {
  label: string;
  description?: ReactNode;
  /** e.g. <Badge variant="cobalt">Recommended</Badge> */
  badge?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  /** Called on every change; pair with useAutoSave (no Save button). */
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Why it's disabled, e.g. "Available on the Student plan". */
  disabledReason?: string;
  /** Select, button or link on the right. */
  right?: ReactNode;
  /** Nested options revealed while the switch is on. */
  children?: ReactNode;
};

/** Switch + label + description; the label toggles the switch. */
export function SettingsRow({
  label,
  description,
  badge,
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  disabledReason,
  right,
  children,
}: SettingsRowProps) {
  const id = useId();
  const [inner, setInner] = useState(defaultChecked);
  const on = checked ?? inner;
  const describedBy = [
    description && `${id}-description`,
    disabled && disabledReason && `${id}-reason`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div data-slot="settings-row">
      <div className="flex items-start gap-4 p-4">
        <Switch
          id={id}
          checked={on}
          disabled={disabled}
          aria-describedby={describedBy || undefined}
          onCheckedChange={(next) => {
            setInner(next);
            onCheckedChange?.(next);
          }}
          className="mt-0.5"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={id}
              className={cn(
                "text-body font-medium",
                disabled ? "cursor-not-allowed text-graphite" : "cursor-pointer text-ink",
              )}
            >
              {label}
            </label>
            {badge}
          </div>
          {description && (
            <p id={`${id}-description`} className="text-small text-graphite">
              {description}
            </p>
          )}
          {disabled && disabledReason && (
            <p id={`${id}-reason`} className="flex items-center gap-1 text-small text-graphite">
              <Lock aria-hidden className="size-3.5 shrink-0" />
              {disabledReason}
            </p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {children && <SettingsSubOptions open={on && !disabled}>{children}</SettingsSubOptions>}
    </div>
  );
}

/** Nested options under a row: expand with grid-template-rows 0fr → 1fr; inert while hidden. */
export function SettingsSubOptions({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      data-slot="settings-sub-options"
      data-state={open ? "open" : "closed"}
      inert={!open}
      className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-(--dur-base) ease-out data-[state=open]:grid-rows-[1fr]"
    >
      <div className="min-h-0 overflow-hidden">
        <div className="flex flex-col gap-1 pb-4 pl-[68px]">{children}</div>
      </div>
    </div>
  );
}

/**
 * Auto-save for settings: run `save`, then toast "Saved"; on failure toast an error with
 * "Try again" that retries the same value.
 */
export function useAutoSave<T>(save: (value: T) => Promise<void>) {
  return useCallback(
    function run(value: T): Promise<void> {
      return save(value).then(
        () => {
          toast.success("Saved");
        },
        () => {
          toast.error("Couldn't save this setting", {
            description: "Check your connection, then try again.",
            action: { label: "Try again", onClick: () => void run(value) },
          });
        },
      );
    },
    [save],
  );
}

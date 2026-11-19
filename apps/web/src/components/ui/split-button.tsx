"use client";

import { ChevronDown, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

export type SplitButtonOption = {
  label: string;
  onSelect: () => void;
  icon?: LucideIcon;
};

type SplitButtonProps = {
  /** The main action, a verb + object ("New notebook"). */
  label: string;
  onClick: () => void;
  options: SplitButtonOption[];
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  leadingIcon?: LucideIcon;
  disabled?: boolean;
  className?: string;
  /** Demo state for the showcase, applied to both halves. */
  "data-force"?: string;
};

/**
 * A main action and a chevron that opens related actions: two separate focusable buttons joined
 * visually by a shared border and a 1px divider.
 */
export function SplitButton({
  label,
  onClick,
  options,
  variant = "primary",
  size = "md",
  leadingIcon,
  disabled,
  className,
  "data-force": force,
}: SplitButtonProps) {
  const filled = variant !== "secondary";
  return (
    <div data-slot="split-button" className={cn("inline-flex", className)}>
      <Button
        variant={variant}
        size={size}
        leadingIcon={leadingIcon}
        disabled={disabled}
        onClick={onClick}
        data-force={force}
        className="rounded-r-none"
      >
        {label}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <IconButton
            icon={ChevronDown}
            aria-label={`More options for ${label}`}
            variant={variant}
            size={size}
            data-force={force}
            className={cn(
              "rounded-l-none border-l",
              filled ? "border-l-current/25" : "-ml-px border-rule",
            )}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {options.map((option) => (
            <DropdownMenuItem key={option.label} icon={option.icon} onSelect={option.onSelect}>
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

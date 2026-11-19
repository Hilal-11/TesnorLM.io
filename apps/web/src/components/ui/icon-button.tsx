"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Loader2, type LucideIcon } from "lucide-react";
import { buttonColors } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const iconButtonVariants = cva(
  "interactive relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-sm select-none active:scale-94 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-loading:cursor-progress [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: buttonColors,
      size: {
        sm: "size-8 [&_svg]:size-4",
        md: "size-9 [&_svg]:size-4",
        lg: "size-11 [&_svg]:size-4.5",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export type IconButtonProps = Omit<React.ComponentProps<"button">, "children" | "aria-label"> &
  VariantProps<typeof iconButtonVariants> & {
    /** Required: icon-only buttons need an accessible name. Also used as the tooltip text. */
    "aria-label": string;
    icon: LucideIcon;
    /** Optional shortcut shown in the tooltip, e.g. ["mod", "K"]. */
    shortcut?: string[];
    /** Set false when a parent already provides a tooltip. */
    tooltip?: boolean;
    loading?: boolean;
  };

export function IconButton({
  className,
  variant,
  size,
  icon: Icon,
  shortcut,
  tooltip = true,
  loading = false,
  onClick,
  ...props
}: IconButtonProps) {
  const button = (
    <button
      data-slot="icon-button"
      type="button"
      {...props}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      className={cn(iconButtonVariants({ variant, size }), className)}
      onClick={(event) => {
        if (loading || props["aria-disabled"] === true || props["aria-disabled"] === "true") {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {loading ? <Loader2 aria-hidden className="animate-spin" /> : <Icon aria-hidden />}
    </button>
  );

  if (!tooltip) return button;
  return (
    <Tooltip label={props["aria-label"]} shortcut={shortcut}>
      {button}
    </Tooltip>
  );
}

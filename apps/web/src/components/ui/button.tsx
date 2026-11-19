"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Loader2, type LucideIcon } from "lucide-react";
import { Slot as SlotPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Colour per variant, shared with IconButton. Hover darkens 6% toward --shade (skill 8.1);
 * `hover:` also matches data-force="hover" so the showcase can show the state statically.
 */
export const buttonColors = {
  primary:
    "bg-cobalt text-primary-foreground hover:bg-[color-mix(in_oklab,var(--cobalt),var(--shade)_6%)]",
  dark: "bg-ink text-paper hover:bg-[color-mix(in_oklab,var(--ink),var(--graphite)_16%)]",
  secondary: "border border-rule bg-sheet text-ink hover:bg-cobalt-soft/50",
  ghost: "text-ink hover:bg-cobalt-soft",
  danger:
    "bg-danger text-danger-foreground hover:bg-[color-mix(in_oklab,var(--danger),var(--shade)_6%)]",
} as const;

export const buttonVariants = cva(
  "interactive relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-sm font-medium whitespace-nowrap select-none active:scale-98 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-loading:cursor-progress [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        ...buttonColors,
        link: "rounded-xs text-cobalt link-underline active:scale-100",
      },
      size: {
        sm: "h-8 px-3 text-small [&_svg]:size-4",
        md: "h-9 px-4 text-body [&_svg]:size-4",
        lg: "h-11 px-5 text-body [&_svg]:size-4.5",
      },
    },
    compoundVariants: [{ variant: "link", size: ["sm", "md", "lg"], className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a Next.js <Link>) with button styling. */
    asChild?: boolean;
    leadingIcon?: LucideIcon;
    trailingIcon?: LucideIcon;
    /** Shows a spinner, keeps the label and width, sets aria-busy and ignores clicks. */
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  leadingIcon: Leading,
  trailingIcon: Trailing,
  loading = false,
  disabled,
  onClick,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? SlotPrimitive.Slot : "button";
  const ariaDisabled = props["aria-disabled"] === true || props["aria-disabled"] === "true";
  const blocked = loading || ariaDisabled || (asChild && disabled);
  const spinner = <Loader2 aria-hidden className="animate-spin" />;

  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? "primary"}
      type={asChild ? undefined : (props.type ?? "button")}
      {...props}
      disabled={asChild ? undefined : disabled}
      aria-disabled={asChild && disabled ? true : props["aria-disabled"]}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        if (blocked) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {Leading && (loading ? spinner : <Leading aria-hidden />)}
      {loading && !Leading && !asChild && (
        <span className="absolute inset-0 flex items-center justify-center">{spinner}</span>
      )}
      <SlotPrimitive.Slottable>
        {asChild ? (
          children
        ) : (
          <span
            className={cn("inline-flex items-center gap-2", loading && !Leading && "opacity-0")}
          >
            {children}
          </span>
        )}
      </SlotPrimitive.Slottable>
      {Trailing && <Trailing aria-hidden />}
    </Comp>
  );
}

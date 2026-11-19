import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex h-5 shrink-0 items-center gap-1 rounded-xs px-2 text-small font-medium whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-graphite",
        cobalt: "bg-cobalt-soft text-cobalt",
        success: "bg-success/12 text-success-strong",
        warning: "bg-warning/12 text-warning-strong",
        danger: "bg-danger/12 text-danger-strong",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

/** Short sentence-case label: "Pro", "Beta", "New", "Recommended". */
export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

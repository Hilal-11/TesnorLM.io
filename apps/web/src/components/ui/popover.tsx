"use client";

import { Popover as PopoverPrimitive } from "radix-ui";
import { menuSurface } from "@/components/ui/dropdown-menu";
import { usePortalContainer } from "@/components/ui/portal-container";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

/** Same surface as menus: sheet-2, r-md, shadow-2 (rule border in dark). */
export function PopoverContent({
  className,
  sideOffset = 6,
  arrow = false,
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & { arrow?: boolean }) {
  return (
    <PopoverPrimitive.Portal container={usePortalContainer()}>
      <PopoverPrimitive.Content
        data-slot="popover"
        sideOffset={sideOffset}
        className={cn(
          menuSurface,
          "w-72 origin-(--radix-popover-content-transform-origin) overflow-visible p-4",
          className,
        )}
        {...props}
      >
        {children}
        {arrow && <PopoverPrimitive.Arrow className="fill-sheet-2" width={12} height={6} />}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

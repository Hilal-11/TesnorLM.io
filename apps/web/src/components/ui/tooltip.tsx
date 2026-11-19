"use client";

import { createContext, use, type ReactElement, type ReactNode } from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { Kbd } from "@/components/ui/kbd";
import { usePortalContainer } from "@/components/ui/portal-container";
import { cn } from "@/lib/utils";

const HasProvider = createContext(false);

/** App-level provider: 400ms open delay, then no delay when moving between tooltips (skill). */
export function TooltipProvider({
  delayDuration = 400,
  skipDelayDuration = 300,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <HasProvider value>
      <TooltipPrimitive.Provider
        delayDuration={delayDuration}
        skipDelayDuration={skipDelayDuration}
        {...props}
      />
    </HasProvider>
  );
}

function EnsureProvider({ children }: { children: ReactNode }) {
  return use(HasProvider) ? children : <TooltipProvider>{children}</TooltipProvider>;
}

export const tooltipSurface =
  "flex max-w-xs items-center gap-2 rounded-sm border border-rule bg-sheet-2 px-2 py-1 text-small text-ink shadow-2";

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal container={usePortalContainer()}>
      <TooltipPrimitive.Content
        data-slot="tooltip"
        sideOffset={sideOffset}
        className={cn(
          tooltipSurface,
          "z-50 origin-(--radix-tooltip-content-transform-origin) data-[state=closed]:animate-fade-out data-[state=delayed-open]:animate-fade-in data-[state=instant-open]:animate-fade-in",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

type TooltipProps = {
  /** The tooltip text. Never the only way to get important information. */
  label: ReactNode;
  /** Optional shortcut shown as <Kbd>, e.g. ["mod", "C"]. */
  shortcut?: string[];
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  tone?: "default" | "danger";
};

export function Tooltip({
  label,
  shortcut,
  children,
  side,
  open,
  onOpenChange,
  tone = "default",
}: TooltipProps) {
  return (
    <EnsureProvider>
      <TooltipPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipContent side={side} className={cn(tone === "danger" && "text-danger-strong")}>
          <span>{label}</span>
          {shortcut && <Kbd keys={shortcut} />}
        </TooltipContent>
      </TooltipPrimitive.Root>
    </EnsureProvider>
  );
}

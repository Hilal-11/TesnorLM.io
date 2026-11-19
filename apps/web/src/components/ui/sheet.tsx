"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useRef, useState, type ReactNode } from "react";
import { DialogOverlay } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { usePortalContainer } from "@/components/ui/portal-container";
import { useIsDesktop } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

/** Bottom sheet snap points as a share of the sheet height (skill 6.2). */
export const SNAP_POINTS = [0.25, 0.5, 1] as const;
const SNAP_LABELS = { 0.25: "Peek", 0.5: "Half", 1: "Full" } as const;

type SheetContentProps = {
  title: ReactNode;
  description?: ReactNode;
  /** "auto": a side sheet from 768px, a bottom sheet below. */
  side?: "auto" | "right" | "bottom";
  defaultSnap?: (typeof SNAP_POINTS)[number];
  className?: string;
  children: ReactNode;
};

export function SheetContent({
  title,
  description,
  side = "auto",
  defaultSnap = 0.5,
  className,
  children,
}: SheetContentProps) {
  const isDesktop = useIsDesktop();
  const resolved = side === "auto" ? (isDesktop ? "right" : "bottom") : side;
  return (
    <DialogPrimitive.Portal container={usePortalContainer()}>
      <DialogOverlay />
      {resolved === "right" ? (
        <DialogPrimitive.Content
          data-slot="sheet"
          data-side="right"
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-[clamp(420px,40vw,560px)] max-w-full flex-col rounded-l-lg border-l border-rule bg-popover text-ink shadow-3 data-[state=closed]:animate-slide-out-right data-[state=open]:animate-slide-in-right",
            className,
          )}
        >
          <SheetHeader title={title} description={description} />
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-rule p-6">{children}</div>
        </DialogPrimitive.Content>
      ) : (
        <BottomSheet
          title={title}
          description={description}
          defaultSnap={defaultSnap}
          className={className}
        >
          {children}
        </BottomSheet>
      )}
    </DialogPrimitive.Portal>
  );
}

function SheetHeader({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex items-start gap-4 px-6 pt-4 pb-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <DialogPrimitive.Title className="text-h3">{title}</DialogPrimitive.Title>
        {description && (
          <DialogPrimitive.Description className="text-small text-graphite">
            {description}
          </DialogPrimitive.Description>
        )}
      </div>
      <DialogPrimitive.Close asChild>
        <IconButton icon={X} aria-label="Close" size="sm" tooltip={false} />
      </DialogPrimitive.Close>
    </div>
  );
}

/**
 * Mobile bottom sheet with three snap points (peek 25%, half, full). Drag the handle, or press it
 * to step through the snap points. Esc closes. Moves with transform only.
 */
function BottomSheet({
  title,
  description,
  defaultSnap,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  defaultSnap: (typeof SNAP_POINTS)[number];
  className?: string;
  children: ReactNode;
}) {
  const [snap, setSnap] = useState<(typeof SNAP_POINTS)[number]>(defaultSnap);
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef(0);
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  function settle(offset: number) {
    const height = panel.current?.offsetHeight ?? window.innerHeight;
    const visible = snap - offset / height;
    if (visible < 0.15) {
      closeRef.current?.click();
      return;
    }
    const nearest = SNAP_POINTS.reduce((a, b) =>
      Math.abs(b - visible) < Math.abs(a - visible) ? b : a,
    );
    setSnap(nearest);
  }

  const nextSnap = SNAP_POINTS[(SNAP_POINTS.indexOf(snap) + 1) % SNAP_POINTS.length];

  return (
    <DialogPrimitive.Content
      ref={panel}
      data-slot="sheet"
      data-side="bottom"
      data-snap={snap}
      {...(description ? {} : { "aria-describedby": undefined })}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex h-[calc(100dvh-1rem)] flex-col rounded-t-lg border-t border-rule bg-popover pb-[env(safe-area-inset-bottom)] text-ink shadow-3 data-[state=closed]:animate-slide-out-down data-[state=open]:animate-slide-in-up",
        drag === null && "transition-transform duration-(--dur-slow) ease-out",
        className,
      )}
      style={{ transform: `translateY(max(0px, calc(${(1 - snap) * 100}% + ${drag ?? 0}px)))` }}
    >
      <button
        type="button"
        aria-label={`Resize sheet. Now ${SNAP_LABELS[snap]}. Press for ${SNAP_LABELS[nextSnap]}.`}
        className="flex h-6 w-full shrink-0 cursor-grab touch-none items-center justify-center rounded-t-lg active:cursor-grabbing"
        onClick={() => setSnap(nextSnap)}
        onPointerDown={(e) => {
          start.current = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag(0);
        }}
        onPointerMove={(e) => {
          if (drag !== null) setDrag(e.clientY - start.current);
        }}
        onPointerUp={(e) => {
          if (drag !== null && Math.abs(drag) > 4) {
            e.preventDefault();
            settle(drag);
          }
          setDrag(null);
        }}
      >
        <span aria-hidden className="h-1 w-10 rounded-full bg-rule-strong" />
      </button>
      <SheetHeader title={title} description={description} />
      <DialogPrimitive.Close ref={closeRef} className="hidden" tabIndex={-1} aria-hidden />
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-rule p-6">{children}</div>
    </DialogPrimitive.Content>
  );
}

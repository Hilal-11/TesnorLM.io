"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { usePortalContainer } from "@/components/ui/portal-container";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const WIDTHS = { sm: "max-w-[400px]", md: "max-w-[520px]", lg: "max-w-[720px]" } as const;

/** Panel surface shared by the live dialog and static previews. */
export const dialogPanel =
  "flex max-h-[85vh] w-full flex-col overflow-hidden rounded-lg border border-rule bg-popover text-ink shadow-3";

/** Dotted dim backdrop: ink at 40% (paper at 60% in dark) plus a 16px dot grid. */
export function DialogOverlay({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 scrim-dots data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in",
        className,
      )}
    />
  );
}

type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  size?: keyof typeof WIDTHS;
  /** Close button in the corner ("Close dialog"). */
  showClose?: boolean;
};

/**
 * Modal: focus is trapped, Esc closes, focus returns to the trigger, page scroll locks.
 * Initial focus goes to the first field, else to an element marked `data-autofocus`.
 */
export function DialogContent({
  size = "md",
  showClose = true,
  className,
  children,
  onOpenAutoFocus,
  ...props
}: DialogContentProps) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <DialogPrimitive.Portal container={usePortalContainer()}>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-slot="dialog"
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          if (event.defaultPrevented) return;
          const target = ref.current?.querySelector<HTMLElement>(
            "input:not([type=hidden]):not(:disabled), textarea:not(:disabled), [data-autofocus]",
          );
          if (target) {
            event.preventDefault();
            target.focus();
          }
        }}
        className={cn(
          dialogPanel,
          WIDTHS[size],
          "fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in",
          className,
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close asChild>
            <IconButton
              icon={X}
              aria-label="Close dialog"
              size="sm"
              tooltip={false}
              className="absolute top-4 right-4"
            />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({
  title,
  description,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1 px-6 pt-6 pr-14 pb-4", className)}>
      <DialogPrimitive.Title className="text-h3 text-ink">{title}</DialogPrimitive.Title>
      {description && (
        <DialogPrimitive.Description className="text-small text-graphite [&_a]:text-primary [&_a]:underline">
          {description}
        </DialogPrimitive.Description>
      )}
    </div>
  );
}

/** Scrolling body under a 1px rule divider. */
export function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto border-t border-rule px-6 py-4",
        className,
      )}
      {...props}
    />
  );
}

/** Right-aligned: secondary "Cancel" then the primary action (verb + object). */
export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex justify-end gap-2 px-6 pt-2 pb-6", className)} {...props} />;
}

type TypedConfirmDialogProps = {
  trigger: React.ReactElement;
  title: string;
  description: ReactNode;
  /** What the person must type, e.g. the notebook name. */
  confirmText: string;
  actionLabel: string;
  onConfirm: () => void;
};

/**
 * For the rare destructive action that can't be undone. Prefer an Undo toast wherever undo is
 * possible (skill 8.4). The action stays disabled until the text matches exactly.
 */
export function TypedConfirmDialog({
  trigger,
  title,
  description,
  confirmText,
  actionLabel,
  onConfirm,
}: TypedConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader title={title} description={description} />
        <DialogBody>
          <Field
            label={
              <>
                Type <span className="font-mono">{confirmText}</span> to confirm
              </>
            }
          >
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button
            variant="danger"
            disabled={typed !== confirmText}
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
          >
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

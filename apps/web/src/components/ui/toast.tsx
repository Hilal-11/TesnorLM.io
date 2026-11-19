"use client";

import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { useIsDesktop } from "@/hooks/use-media-query";

type ToastOptions = {
  description?: string;
  /** e.g. { label: "Undo", onClick } — Undo toasts stay 8s instead of 4s. */
  action?: { label: string; onClick: () => void };
  duration?: number;
};

/** Toast surface, also used by static previews. */
export const toastSurface =
  "flex w-[356px] max-w-[calc(100vw-2rem)] items-center gap-3 rounded-md border border-rule bg-popover p-4 text-ink shadow-2";
export const toastAction =
  "interactive ml-auto h-8 shrink-0 cursor-pointer rounded-sm px-3 text-small font-medium text-primary hover:bg-accent active:scale-98";

let announceAssertive: ((message: string) => void) | null = null;

function options(opts: ToastOptions = {}) {
  return {
    description: opts.description,
    duration: opts.duration ?? (opts.action?.label === "Undo" ? 8000 : 4000),
    action: opts.action && { label: opts.action.label, onClick: opts.action.onClick },
  };
}

/** Toast helpers (skill 8.4): the verb matches the button that caused it ("Source deleted"). */
export const toast = {
  success: (message: string, opts?: ToastOptions) => sonnerToast.success(message, options(opts)),
  info: (message: string, opts?: ToastOptions) => sonnerToast.info(message, options(opts)),
  /** Errors are also announced assertively. Say what happened and how to fix it. */
  error: (message: string, opts?: ToastOptions) => {
    announceAssertive?.(opts?.description ? `${message}. ${opts.description}` : message);
    return sonnerToast.error(message, options(opts));
  },
  dismiss: sonnerToast.dismiss,
};

/**
 * Bottom-left on desktop, top on mobile; 4s, pause on hover, at most 3 visible, Esc dismisses.
 * Mount once at the app root.
 */
export function Toaster() {
  const isDesktop = useIsDesktop();
  const [alert, setAlert] = useState("");

  useEffect(() => {
    announceAssertive = (message) => {
      setAlert("");
      requestAnimationFrame(() => setAlert(message));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const active = document.activeElement;
      const inToaster = active?.closest("[data-sonner-toaster]");
      const toastsOpen = document.querySelector("[data-sonner-toast]");
      const overlayOpen = document.querySelector("[role=dialog][data-state=open], [role=menu]");
      if (inToaster || (toastsOpen && !overlayOpen)) sonnerToast.dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      announceAssertive = null;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <>
      <Sonner
        position={isDesktop ? "bottom-left" : "top-center"}
        visibleToasts={3}
        gap={8}
        containerAriaLabel="Notifications"
        icons={{
          success: <CircleCheck aria-hidden className="size-4 text-success-strong" />,
          error: <CircleAlert aria-hidden className="size-4 text-danger-strong" />,
          info: <Info aria-hidden className="size-4 text-primary" />,
        }}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: toastSurface,
            title: "text-body font-medium",
            description: "text-small text-graphite",
            icon: "flex shrink-0 items-center",
            content: "flex min-w-0 flex-1 flex-col gap-1",
            actionButton: toastAction,
          },
        }}
      />
      <div aria-live="assertive" className="sr-only">
        {alert}
      </div>
    </>
  );
}

"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { iconButtonVariants } from "@/components/ui/icon-button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const COPY_ERROR = "Couldn't copy. Select the text and press Ctrl+C.";
const COPIED_MS = 1500;

type CopyButtonProps = Omit<React.ComponentProps<"button">, "value" | "children"> & {
  value: string;
  /** Accessible name and tooltip. */
  label?: string;
  /** Show the label next to the icon (e.g. on code blocks). */
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
};

/** Copies `value`; the icon morphs to a check for 1.5s and "Copied" is announced (skill 8.1). */
export function CopyButton({
  value,
  label = "Copy",
  showLabel = false,
  size = "sm",
  className,
  ...props
}: CopyButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const [hovered, setHovered] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    let next: "copied" | "error";
    try {
      await navigator.clipboard.writeText(value);
      next = "copied";
    } catch {
      next = "error";
    }
    setStatus(next);
    timer.current = setTimeout(() => setStatus("idle"), next === "copied" ? COPIED_MS : 4000);
  }

  const copied = status === "copied";
  const message = copied ? "Copied" : status === "error" ? COPY_ERROR : label;

  return (
    <>
      <Tooltip
        label={message}
        tone={status === "error" ? "danger" : "default"}
        open={status !== "idle" || hovered}
        onOpenChange={setHovered}
      >
        <button
          type="button"
          aria-label={label}
          {...props}
          onClick={copy}
          className={cn(
            iconButtonVariants({ variant: "ghost", size }),
            "hover:text-cobalt",
            showLabel && "w-auto gap-2 px-3 text-small font-medium",
            className,
          )}
        >
          <span className="relative size-4">
            <Copy
              aria-hidden
              className={cn(
                "absolute inset-0 transition-[opacity,scale] duration-(--dur-base) ease-spring",
                copied ? "scale-50 opacity-0" : "scale-100 opacity-100",
              )}
            />
            <Check
              aria-hidden
              className={cn(
                "absolute inset-0 text-success-strong transition-[opacity,scale] duration-(--dur-base) ease-spring",
                copied ? "scale-100 opacity-100" : "scale-50 opacity-0",
              )}
            />
          </span>
          {showLabel && <span aria-hidden>{copied ? "Copied" : label}</span>}
        </button>
      </Tooltip>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : status === "error" ? COPY_ERROR : ""}
      </span>
    </>
  );
}

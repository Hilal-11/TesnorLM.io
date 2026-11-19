"use client";

import { useIsMac } from "@/hooks/use-is-mac";
import { cn } from "@/lib/utils";

const MAC: Record<string, string> = { mod: "⌘", alt: "⌥", shift: "⇧", ctrl: "⌃", enter: "↵" };
const PC: Record<string, string> = { mod: "Ctrl", alt: "Alt", shift: "Shift", ctrl: "Ctrl" };

export function formatKeys(keys: string[], isMac: boolean) {
  return keys.map((k) => (isMac ? MAC : PC)[k.toLowerCase()] ?? k).join(" ");
}

type KbdProps = React.ComponentProps<"kbd"> & {
  /** e.g. ["mod", "K"] → "Ctrl K" on Windows/Linux, "⌘ K" on Mac. */
  keys?: string[];
};

/** Keyboard key or shortcut, in JetBrains Mono (skill 8.5). */
export function Kbd({ keys, className, children, ...props }: KbdProps) {
  const isMac = useIsMac();
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-xs border border-b-2 border-rule bg-sheet px-1 font-mono text-[0.75rem] leading-4 font-medium text-graphite",
        className,
      )}
      {...props}
    >
      {keys ? formatKeys(keys, isMac) : children}
    </kbd>
  );
}

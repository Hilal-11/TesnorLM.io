"use client";

import { Avatar as AvatarPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const SIZES = {
  24: "size-6 text-[0.625rem]",
  32: "size-8 text-[0.75rem]",
  40: "size-10 text-small",
} as const;

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

type AvatarProps = {
  name: string;
  src?: string;
  size?: keyof typeof SIZES;
  /** Hide from assistive tech when the name is already next to it. */
  decorative?: boolean;
  className?: string;
};

/** Photo with an initials fallback (ink on cobalt-soft). */
export function Avatar({ name, src, size = 32, decorative = false, className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full bg-cobalt-soft select-none",
        SIZES[size],
        className,
      )}
    >
      {src && <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" />}
      <AvatarPrimitive.Fallback
        delayMs={src ? 400 : undefined}
        className="flex size-full items-center justify-center font-semibold text-ink"
      >
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

type AvatarStackProps = {
  people: { name: string; src?: string }[];
  max?: number;
  size?: keyof typeof SIZES;
  /** Ring colour matching the surface underneath. */
  surface?: "paper" | "sheet";
  className?: string;
};

/** Overlapping avatars with a "+N" counter, labelled "Shared with N people". */
export function AvatarStack({
  people,
  max = 4,
  size = 32,
  surface = "paper",
  className,
}: AvatarStackProps) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  const ring = surface === "paper" ? "ring-2 ring-paper" : "ring-2 ring-sheet";
  const label = `Shared with ${people.length} ${people.length === 1 ? "person" : "people"}`;
  return (
    <div role="img" aria-label={label} className={cn("flex items-center -space-x-2", className)}>
      {shown.map((person) => (
        <Avatar key={person.name} {...person} size={size} decorative className={ring} />
      ))}
      {rest > 0 && (
        <span
          aria-hidden
          className={cn(
            "relative inline-flex items-center justify-center rounded-full bg-muted font-medium text-graphite tabular-nums",
            SIZES[size],
            ring,
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

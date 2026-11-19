import { cn } from "@/lib/utils";

/** TensorLM mark: a black tile with a white "T" built from a tensor's nodes (inverts in dark). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-ink text-paper",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[62%]" fill="none">
        <path
          d="M5 6.5h14M12 6.5V19"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="5" cy="6.5" r="2" fill="currentColor" />
        <circle cx="19" cy="6.5" r="2" fill="currentColor" />
        <circle cx="12" cy="19" r="2" fill="currentColor" />
      </svg>
    </span>
  );
}

/** Mark plus wordmark. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      {!compact && (
        <span className="text-[0.9375rem] font-semibold tracking-tight text-ink">TensorLM</span>
      )}
      <span className="sr-only">{compact ? "TensorLM" : ""}</span>
    </span>
  );
}

import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Sheet card, r-lg, 400px, with the wordmark, a title and one graphite line under it. */
export function AuthCard({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Band at the bottom of the card, e.g. "New to TensorLM? Create an account". */
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="w-full max-w-[400px] overflow-hidden rounded-lg border border-transparent bg-sheet shadow-2 dark:border-rule">
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-4">
          <p className="text-body font-semibold tracking-tight text-ink">TensorLM</p>
          <div className="flex flex-col gap-1">
            <h1 className="text-h2 text-ink">{title}</h1>
            {subtitle && <p className="text-body text-graphite">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
      {footer && (
        <div className="border-t border-rule bg-paper px-6 py-4 text-center text-body text-graphite sm:px-8">
          {footer}
        </div>
      )}
    </div>
  );
}

/** Form-level error: icon + words, announced. */
export function FormError({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn("flex items-start gap-2 text-small text-danger-strong", className)}
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

/** "or" between OAuth buttons and the email form. */
export function OrDivider() {
  return (
    <div
      className="flex items-center gap-3 text-small text-graphite"
      role="separator"
      aria-label="or"
    >
      <span aria-hidden className="h-px flex-1 bg-rule" />
      <span aria-hidden>or</span>
      <span aria-hidden className="h-px flex-1 bg-rule" />
    </div>
  );
}

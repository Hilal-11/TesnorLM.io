import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

/** Centred sign-in card: logo mark, title, one graphite line, then the form; footer band below. */
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
    <div className="w-full max-w-[400px] overflow-hidden rounded-lg border border-rule bg-sheet shadow-3">
      <div className="flex flex-col gap-6 px-6 pt-8 pb-6 sm:px-10 sm:pt-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <LogoMark className="size-9 rounded-[9px]" />
          <div className="flex flex-col gap-1">
            <h1 className="text-h2 text-ink">{title}</h1>
            {subtitle && <p className="text-small text-graphite">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
      {footer && (
        <div className="border-t border-rule bg-subtle px-6 py-4 text-center text-small text-graphite sm:px-10">
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

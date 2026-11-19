import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Settings page section: h2 title, one-line description, optional action on the right. */
export function SettingsSection({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-6", className)}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={id} className="text-h2 text-ink">
            {title}
          </h2>
          {description && <p className="measure text-body text-graphite">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

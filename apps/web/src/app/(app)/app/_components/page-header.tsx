import type { ReactNode } from "react";

/** Page title (h1), one graphite line, optional action on the right. Left-aligned. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-h1 text-ink">{title}</h1>
        {description && <p className="measure text-body text-graphite">{description}</p>}
      </div>
      {action}
    </header>
  );
}

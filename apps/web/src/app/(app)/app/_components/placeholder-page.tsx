import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "./page-header";

/** A nav route that isn't built yet: page title plus one empty state with one action. */
export function PlaceholderPage({
  title,
  description,
  icon,
  emptyTitle,
  emptyBody,
  actionLabel,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyBody: string;
  actionLabel: string;
}) {
  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <PageHeader title={title} description={description} />
      <div className="rounded-md border border-rule bg-sheet">
        <EmptyState
          titleAs="h2"
          icon={icon}
          title={emptyTitle}
          description={emptyBody}
          action={{ label: actionLabel, disabledReason: "Coming in the next update" }}
        />
      </div>
    </div>
  );
}

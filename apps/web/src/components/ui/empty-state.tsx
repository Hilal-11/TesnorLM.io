import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  /** One sentence that invites the action (skill 9). */
  description: ReactNode;
  /** Exactly one primary action. */
  action?: {
    label: string;
    icon?: LucideIcon;
    onClick?: () => void;
    /** Not available yet: the button stays focusable, shows this in a tooltip, and does nothing. */
    disabledReason?: string;
  };
  /** Example questions shown as chips. */
  examples?: string[];
  onExample?: (example: string) => void;
  /** Graph-paper background: only for the empty state of a new notebook. */
  graphPaper?: boolean;
  titleAs?: "h2" | "h3";
  className?: string;
};

/** Centred empty state: icon, title, one sentence, one action, optional example chips. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  examples,
  onExample,
  graphPaper = false,
  titleAs: Title = "h3",
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center gap-4 px-6 py-12 text-center",
        graphPaper && "graph-paper rounded-md",
        className,
      )}
    >
      {Icon && <Icon aria-hidden className="size-6 text-graphite" />}
      <div className="flex flex-col items-center gap-1">
        <Title className="text-h3 text-ink">{title}</Title>
        <p className="max-w-[46ch] text-body text-balance text-graphite">{description}</p>
      </div>
      {action &&
        (action.disabledReason ? (
          <Tooltip label={action.disabledReason}>
            <Button aria-disabled>
              {action.icon && <action.icon aria-hidden />}
              {action.label}
            </Button>
          </Tooltip>
        ) : (
          <Button onClick={action.onClick}>
            {action.icon && <action.icon aria-hidden />}
            {action.label}
          </Button>
        ))}
      {examples && examples.length > 0 && (
        <ul aria-label="Example questions" className="flex flex-wrap justify-center gap-2">
          {examples.map((example) => (
            <li key={example}>
              <Button variant="secondary" size="sm" onClick={() => onExample?.(example)}>
                {example}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

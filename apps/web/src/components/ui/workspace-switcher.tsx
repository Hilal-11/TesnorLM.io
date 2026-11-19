"use client";

import { ChevronsUpDown, Plus, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type Workspace = { id: string; name: string; plan?: string };

type WorkspaceSwitcherProps = {
  workspaces: Workspace[];
  currentId: string;
  onSelect: (id: string) => void;
  onCreate?: () => void;
  onSettings?: () => void;
  compact?: boolean;
  className?: string;
};

/** Card-like trigger with logo square, name and plan; switches workspace from a menu. */
export function WorkspaceSwitcher({
  workspaces,
  currentId,
  onSelect,
  onCreate,
  onSettings,
  compact = false,
  className,
}: WorkspaceSwitcherProps) {
  const current = workspaces.find((w) => w.id === currentId) ?? workspaces[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={compact ? `Workspace: ${current.name}` : undefined}
          className={cn(
            "flex w-full cursor-pointer items-center gap-2.5 rounded-md border border-rule bg-sheet p-1.5 text-left shadow-1 interactive hover:bg-muted active:scale-98",
            compact && "size-10 justify-center p-0",
            className,
          )}
        >
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-muted text-small font-semibold text-ink"
          >
            {current.name.slice(0, 1).toUpperCase()}
          </span>
          {!compact && (
            <>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body font-medium text-ink">{current.name}</span>
                {current.plan && (
                  <span className="truncate text-caption text-graphite">{current.plan} plan</span>
                )}
              </span>
              <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-graphite" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-(--radix-dropdown-menu-trigger-width)">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={current.id} onValueChange={onSelect}>
          {workspaces.map((w) => (
            <DropdownMenuRadioItem key={w.id} value={w.id}>
              {w.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={Plus} onSelect={onCreate} disabled={!onCreate}>
          Create workspace
          {!onCreate && <span className="ml-auto text-small text-graphite">Coming soon</span>}
        </DropdownMenuItem>
        <DropdownMenuItem icon={Settings} onSelect={onSettings} disabled={!onSettings}>
          Settings
          {!onSettings && <span className="ml-auto text-small text-graphite">Coming soon</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { ChevronsUpDown, Plus, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
            "flex w-full cursor-pointer items-center gap-3 rounded-md border border-rule bg-sheet p-2 text-left interactive hover:bg-cobalt-soft/50 active:scale-98",
            compact && "size-11 justify-center p-0",
            className,
          )}
        >
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-ink text-small font-semibold text-paper"
          >
            {current.name.slice(0, 1).toUpperCase()}
          </span>
          {!compact && (
            <>
              <span className="min-w-0 flex-1 truncate text-body font-medium text-ink">
                {current.name}
              </span>
              {current.plan && <Badge variant="cobalt">{current.plan}</Badge>}
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
        <DropdownMenuItem icon={Plus} onSelect={onCreate}>
          Create workspace
        </DropdownMenuItem>
        <DropdownMenuItem icon={Settings} onSelect={onSettings}>
          Settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

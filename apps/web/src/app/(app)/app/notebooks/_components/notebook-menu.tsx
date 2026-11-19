"use client";

import {
  CalendarDays,
  MoreHorizontal,
  Palette,
  Pencil,
  Settings2,
  Trash2,
  MoveRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import {
  COLOR_LABELS,
  NOTEBOOK_COLORS,
  NOTEBOOK_STATUSES,
  STATUS_LABELS,
  type Notebook,
  type NotebookColor,
  type NotebookStatus,
} from "@/lib/notebooks/shared";
import { cn } from "@/lib/utils";
import { ColorDot } from "./notebook-visuals";

export type NotebookMenuHandlers = {
  onRename: (n: Notebook) => void;
  onEdit: (n: Notebook, focus?: "exam_date") => void;
  onColor: (n: Notebook, color: NotebookColor) => void;
  onMove: (n: Notebook, status: NotebookStatus) => void;
  onDelete: (n: Notebook) => void;
};

/** "Notebook options": rename, colour, exam date, move, edit, delete (Undo, no confirm). */
export function NotebookMenu({
  notebook,
  className,
  ...handlers
}: NotebookMenuHandlers & { notebook: Notebook; className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          icon={MoreHorizontal}
          aria-label={`Notebook options for ${notebook.title}`}
          tooltip={false}
          size="sm"
          className={cn("relative z-10", className)}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem icon={Pencil} onSelect={() => handlers.onRename(notebook)}>
          Rename
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger icon={Palette}>Change colour</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={notebook.color}
              onValueChange={(v) => handlers.onColor(notebook, v as NotebookColor)}
            >
              {NOTEBOOK_COLORS.map((color) => (
                <DropdownMenuRadioItem key={color} value={color}>
                  <span className="flex items-center gap-2">
                    <ColorDot color={color} />
                    {COLOR_LABELS[color]}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem
          icon={CalendarDays}
          onSelect={() => handlers.onEdit(notebook, "exam_date")}
        >
          Set exam date
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger icon={MoveRight}>Move to…</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={notebook.status}
              onValueChange={(v) => handlers.onMove(notebook, v as NotebookStatus)}
            >
              {NOTEBOOK_STATUSES.map((status) => (
                <DropdownMenuRadioItem key={status} value={status}>
                  {STATUS_LABELS[status]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem icon={Settings2} onSelect={() => handlers.onEdit(notebook)}>
          Edit details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={Trash2} destructive onSelect={() => handlers.onDelete(notebook)}>
          Delete notebook
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

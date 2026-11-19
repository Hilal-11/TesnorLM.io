"use client";

import { ChevronsUpDown } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { updateProfile } from "../../../actions/profile";

const LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "expert", label: "Expert" },
] as const;
type Level = (typeof LEVELS)[number]["value"];

/** "● Intermediate" next to the breadcrumb: how answers are pitched. Saves to the profile. */
export function LevelSwitch({ level }: { level: Level }) {
  const [optimistic, setOptimistic] = useOptimistic(level);
  const [, startTransition] = useTransition();
  const label = LEVELS.find((l) => l.value === optimistic)?.label ?? "Intermediate";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Explanation level: ${label}`}
          className="flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-sm px-2 text-small font-medium text-graphite interactive hover:bg-cobalt-soft/50 hover:text-ink active:scale-98"
        >
          <span aria-hidden className="size-2 rounded-full bg-success" />
          {label}
          <ChevronsUpDown aria-hidden className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Explain at</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={optimistic}
          onValueChange={(value) =>
            startTransition(async () => {
              setOptimistic(value as Level);
              const result = await updateProfile(null, { level: value as Level });
              if (result && !result.ok)
                toast.error("Couldn't change the level", { description: result.error });
            })
          }
        >
          {LEVELS.map((l) => (
            <DropdownMenuRadioItem key={l.value} value={l.value}>
              {l.label} level
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { ChevronsUpDown, Keyboard, LogOut, User } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
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

export type ThemeChoice = "light" | "dark" | "system";

type UserCardProps = {
  name: string;
  email: string;
  avatarSrc?: string;
  theme: ThemeChoice;
  onThemeChange: (theme: ThemeChoice) => void;
  onProfile?: () => void;
  onShortcuts?: () => void;
  onSignOut: () => void;
  compact?: boolean;
  /** Where the menu opens: up from a sidebar footer, down from a top bar. */
  menuSide?: "top" | "bottom";
  className?: string;
};

/** Avatar, name and email; opens Profile, Theme, Keyboard shortcuts and Sign out (last). */
export function UserCard({
  name,
  email,
  avatarSrc,
  theme,
  onThemeChange,
  onProfile,
  onShortcuts,
  onSignOut,
  compact = false,
  menuSide = "top",
  className,
}: UserCardProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full cursor-pointer items-center gap-3 rounded-sm p-2 text-left interactive hover:bg-accent/50 active:scale-98",
            compact && "size-11 justify-center p-0",
            className,
          )}
        >
          {/* Compact: the avatar is the labelled image, so the button's name matches what it shows. */}
          <Avatar name={name} src={avatarSrc} size={32} decorative={!compact} />
          {!compact && (
            <>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body font-medium text-ink">{name}</span>
                <span className="truncate text-small text-graphite">{email}</span>
              </span>
              <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-graphite" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={menuSide}
        align={menuSide === "top" ? "start" : "end"}
        className="min-w-56"
      >
        <DropdownMenuItem icon={User} onSelect={onProfile}>
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(v) => onThemeChange(v as ThemeChoice)}
        >
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={Keyboard} shortcut={["mod", "/"]} onSelect={onShortcuts}>
          Keyboard shortcuts
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={LogOut} onSelect={onSignOut}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

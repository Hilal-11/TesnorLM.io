"use client";

import { Command } from "cmdk";
import { LogOut, Monitor, Moon, Search, Sun, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { signOut } from "../../../(auth)/actions";
import { PRIMARY_NAV, SECONDARY_NAV } from "./nav";

const item =
  "flex h-10 cursor-pointer items-center gap-3 rounded-sm px-3 text-body text-ink outline-none select-none data-[selected=true]:bg-cobalt-soft [&_svg]:size-4 [&_svg]:text-graphite";

/** Ctrl/⌘ K: go to a page, switch theme, sign out. Full search arrives with notebooks. */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [query, setQuery] = useState("");

  const run = (fn: () => void) => {
    onOpenChange(false);
    setQuery("");
    fn();
  };

  const group = (
    heading: string,
    entries: { label: string; icon: LucideIcon; onSelect: () => void }[],
  ) => (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-small [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-graphite"
    >
      {entries.map(({ label, icon: Icon, onSelect }) => (
        <Command.Item key={label} value={label} onSelect={() => run(onSelect)} className={item}>
          <Icon aria-hidden />
          {label}
        </Command.Item>
      ))}
    </Command.Group>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="md"
        showClose={false}
        aria-describedby={undefined}
        className="top-[20vh] translate-y-0"
      >
        <Command label="Command palette" loop>
          <div className="flex items-center gap-3 border-b border-rule px-4">
            <Search aria-hidden className="size-4 shrink-0 text-graphite" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Go to a page or run a command"
              className="h-12 w-full bg-transparent text-body text-ink outline-none placeholder:text-graphite"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-small text-graphite">
              No commands match &ldquo;{query}&rdquo;. Searching your sources arrives with
              notebooks.
            </Command.Empty>
            {group(
              "Go to",
              [...PRIMARY_NAV, ...SECONDARY_NAV].map((n) => ({
                label: n.label,
                icon: n.icon,
                onSelect: () => router.push(n.href),
              })),
            )}
            {group("Theme", [
              { label: "Light theme", icon: Sun, onSelect: () => setTheme("light") },
              { label: "Dark theme", icon: Moon, onSelect: () => setTheme("dark") },
              { label: "System theme", icon: Monitor, onSelect: () => setTheme("system") },
            ])}
            {group("Account", [
              { label: "Sign out", icon: LogOut, onSelect: () => void signOut() },
            ])}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

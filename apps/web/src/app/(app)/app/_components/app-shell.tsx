"use client";

import { CircleHelp, Menu, Moon, Plus, Search, Sun } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { BreadcrumbSwitcher } from "@/components/ui/breadcrumb-switcher";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarCollapseToggle,
  SidebarNavItem,
  SidebarSection,
  SidebarSectionLabel,
} from "@/components/ui/sidebar-nav";
import { UserCard, type ThemeChoice } from "@/components/ui/user-card";
import { WorkspaceSwitcher } from "@/components/ui/workspace-switcher";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { cn } from "@/lib/utils";
import { signOut } from "../../../(auth)/actions";
import { CommandPalette } from "./command-palette";
import { LevelSwitch } from "./level-switch";
import { MobileTabBar } from "./mobile-tab-bar";
import { PRIMARY_NAV, SECONDARY_NAV, isActive, pageTitle } from "./nav";
import { ShortcutsDialog } from "./shortcuts-dialog";

export type ShellUser = {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  avatarUrl: string | null;
  level: "beginner" | "intermediate" | "expert";
  plan: string;
};

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(el?.closest("input, textarea, select, [contenteditable=true]"));
}

export function AppShell({
  user,
  children,
  previewPath,
}: {
  user: ShellUser;
  children: ReactNode;
  /** Dev previews only: render as if on this route. */
  previewPath?: string;
}) {
  const actualPathname = usePathname();
  const pathname = previewPath ?? actualPathname;
  const router = useRouter();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [, startTransition] = useTransition();

  // ≥1280 expanded by default, 1024–1279 collapsed; a choice the person makes wins and is remembered.
  const wide = useMediaQuery("(min-width: 1280px)", true);
  const [storedCollapsed, setStoredCollapsed] = usePersistentState<boolean | null>(
    `tensorlm:sidebar-collapsed:${user.id}`,
    null,
  );
  const collapsed = storedCollapsed ?? !wide;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [newNotebookOpen, setNewNotebookOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (key === "b" && !isTyping(e.target)) {
        e.preventDefault();
        setStoredCollapsed(!collapsed);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collapsed, setStoredCollapsed]);

  const workspaceName = user.firstName ? `${user.firstName}'s workspace` : "My workspace";
  const title = pageTitle(pathname);
  const isDark = resolvedTheme === "dark";

  const userCard = (compact: boolean, menuSide: "top" | "bottom" = "top") => (
    <UserCard
      name={user.name}
      email={user.email}
      avatarSrc={user.avatarUrl ?? undefined}
      theme={(theme as ThemeChoice) ?? "system"}
      onThemeChange={setTheme}
      onProfile={() => router.push("/app/settings")}
      onShortcuts={() => setShortcutsOpen(true)}
      onSignOut={() => startTransition(() => signOut())}
      compact={compact}
      menuSide={menuSide}
    />
  );

  const sidebarBody = (isCollapsed: boolean, onNavigate?: () => void) => (
    <>
      <div className={cn("flex gap-2", isCollapsed ? "flex-col items-center" : "items-center")}>
        <WorkspaceSwitcher
          workspaces={[{ id: "personal", name: workspaceName, plan: user.plan }]}
          currentId="personal"
          onSelect={() => {}}
          compact={isCollapsed}
          className={isCollapsed ? undefined : "min-w-0 flex-1"}
        />
      </div>
      {isCollapsed ? (
        <IconButton
          icon={Plus}
          aria-label="New notebook"
          variant="primary"
          onClick={() => setNewNotebookOpen(true)}
        />
      ) : (
        <Button leadingIcon={Plus} className="w-full" onClick={() => setNewNotebookOpen(true)}>
          New notebook
        </Button>
      )}
      <SidebarSection>
        {PRIMARY_NAV.map((item) => (
          <SidebarNavItem
            key={item.href}
            icon={item.icon}
            label={item.label}
            href={item.href}
            active={isActive(pathname, item.href)}
            onClick={onNavigate}
          />
        ))}
      </SidebarSection>
      {!isCollapsed && (
        <div className="flex flex-col gap-1">
          <SidebarSectionLabel>Notebooks</SidebarSectionLabel>
          <p className="px-3 text-small text-graphite">Your notebooks appear here.</p>
        </div>
      )}
      <div className="mt-auto flex w-full flex-col gap-2">
        <SidebarSection>
          {SECONDARY_NAV.map((item) => (
            <SidebarNavItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              active={isActive(pathname, item.href)}
              onClick={onNavigate}
            />
          ))}
        </SidebarSection>
        {userCard(isCollapsed)}
      </div>
    </>
  );

  return (
    <div className="flex min-h-dvh bg-paper">
      <a
        href="#main"
        className="sr-only z-50 rounded-sm bg-sheet px-4 py-2 text-body text-ink shadow-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      {/* Desktop sidebar (≥1024). The width snaps; no width animation (skill 7.3). */}
      <aside className="sticky top-0 hidden h-dvh shrink-0 border-r border-rule lg:flex">
        <Sidebar collapsed={collapsed} className={cn("h-full", !collapsed && "w-[264px]")}>
          {sidebarBody(collapsed)}
        </Sidebar>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-rule bg-paper px-2 md:px-4">
          <IconButton
            icon={Menu}
            aria-label="Open navigation"
            className="lg:hidden"
            onClick={() => setDrawerOpen(true)}
          />
          <span className="hidden lg:inline-flex">
            <SidebarCollapseToggle
              collapsed={collapsed}
              onCollapsedChange={(c) => setStoredCollapsed(c)}
            />
          </span>

          <p className="min-w-0 flex-1 truncate text-h3 md:hidden">{title}</p>
          <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
            <BreadcrumbSwitcher segments={[{ label: workspaceName }, { label: title }]} />
            <LevelSwitch level={user.level} />
          </div>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden h-9 w-56 cursor-pointer items-center gap-2 rounded-sm border border-rule bg-sheet px-3 text-body text-graphite interactive hover:border-rule-strong md:flex"
          >
            <Search aria-hidden className="size-4" />
            <span className="flex-1 text-left">Search</span>
            <Kbd keys={["mod", "K"]} />
          </button>
          <IconButton
            icon={Search}
            aria-label="Search"
            shortcut={["mod", "K"]}
            className="md:hidden"
            onClick={() => setPaletteOpen(true)}
          />
          <IconButton
            icon={isDark ? Sun : Moon}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          />
          <IconButton
            icon={CircleHelp}
            aria-label="Help"
            className="hidden md:inline-flex"
            onClick={() => router.push("/app/help")}
          />
          <div className="lg:hidden">{userCard(true, "bottom")}</div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="flex-1 px-4 pt-8 pb-28 outline-none md:px-8 md:pb-12"
        >
          {children}
        </main>
      </div>

      {/* Under 1024 the sidebar is a drawer. */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" title="Navigation">
          <Sidebar className="w-full p-0">{sidebarBody(false, () => setDrawerOpen(false))}</Sidebar>
        </SheetContent>
      </Sheet>

      <MobileTabBar pathname={pathname} onAsk={() => setAskOpen(true)} />

      <Sheet open={askOpen} onOpenChange={setAskOpen}>
        <SheetContent side="bottom" title="Ask about your sources" defaultSnap={0.5}>
          <p className="measure text-body text-graphite">
            Asking questions arrives with notebooks. Add a source first, then ask anything about it.
          </p>
        </SheetContent>
      </Sheet>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      <Dialog open={newNotebookOpen} onOpenChange={setNewNotebookOpen}>
        <DialogContent size="sm">
          <DialogHeader
            title="Notebooks are almost here"
            description="Creating notebooks and adding sources arrives in the next update."
          />
          <DialogBody>
            <p className="text-body text-graphite">
              You&apos;ll be able to upload papers, notes and datasets, then ask anything about
              them.
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button data-autofocus>Got it</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

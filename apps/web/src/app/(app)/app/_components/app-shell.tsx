"use client";

import { CircleHelp, Menu, Moon, Plus, Search, Sun } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Logo, LogoMark } from "@/components/logo";
import { BreadcrumbSwitcher } from "@/components/ui/breadcrumb-switcher";
import { Button } from "@/components/ui/button";
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
import { NotebookDialog } from "../notebooks/_components/notebook-dialog";
import { ColorDot } from "../notebooks/_components/notebook-visuals";
import { CommandPalette } from "./command-palette";
import { LevelSwitch } from "./level-switch";
import { MobileTabBar } from "./mobile-tab-bar";
import { PRIMARY_NAV, SECONDARY_NAV, isActive, pageTitle } from "./nav";
import { ShortcutsDialog } from "./shortcuts-dialog";

export type RecentNotebook = { id: string; title: string; color: string };

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
  recentNotebooks = [],
  children,
  previewPath,
}: {
  user: ShellUser;
  /** The six most recently opened notebooks, for the sidebar. */
  recentNotebooks?: RecentNotebook[];
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
      } else if (key === "n" && !isTyping(e.target)) {
        // Some browsers reserve Ctrl/⌘ N for a new window; where they don't, it opens this.
        e.preventDefault();
        setNewNotebookOpen(true);
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
      <div className={cn("flex flex-col gap-3", isCollapsed && "items-center")}>
        <WorkspaceSwitcher
          workspaces={[{ id: "personal", name: workspaceName, plan: user.plan }]}
          currentId="personal"
          onSelect={() => {}}
          compact={isCollapsed}
          className={isCollapsed ? undefined : "w-full"}
        />
        {isCollapsed ? (
          <>
            <IconButton
              icon={Search}
              aria-label="Search"
              shortcut={["mod", "K"]}
              onClick={() => setPaletteOpen(true)}
            />
            <IconButton
              icon={Plus}
              aria-label="New notebook"
              variant="primary"
              onClick={() => setNewNotebookOpen(true)}
            />
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                onNavigate?.();
                setPaletteOpen(true);
              }}
              className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-sm border border-rule bg-sheet px-2.5 text-body text-graphite shadow-1 interactive hover:border-rule-strong hover:text-ink"
            >
              <Search aria-hidden className="size-4" />
              <span className="flex-1 text-left">Search</span>
              <Kbd keys={["mod", "K"]} />
            </button>
            <Button
              leadingIcon={Plus}
              className="w-full"
              onClick={() => {
                onNavigate?.();
                setNewNotebookOpen(true);
              }}
            >
              New notebook
            </Button>
          </>
        )}
      </div>

      <SidebarSection label="Workspace">
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
        <nav
          aria-labelledby={`recent-notebooks${onNavigate ? "-drawer" : ""}`}
          className="flex flex-col gap-1"
        >
          <SidebarSectionLabel id={`recent-notebooks${onNavigate ? "-drawer" : ""}`}>
            Recent notebooks
          </SidebarSectionLabel>
          {recentNotebooks.length === 0 ? (
            <p className="px-2.5 text-small text-graphite">Your notebooks appear here.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {recentNotebooks.map((n) => {
                const href = `/app/notebooks/${n.id}`;
                return (
                  <li key={n.id}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={pathname === href ? "page" : undefined}
                      className="flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-body text-graphite interactive hover:bg-muted hover:text-ink aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-ink"
                    >
                      <ColorDot color={n.color} />
                      <span className="min-w-0 flex-1 truncate">{n.title}</span>
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link
                  href="/app/notebooks"
                  onClick={onNavigate}
                  className="flex h-8 items-center rounded-sm px-2.5 text-small font-medium text-graphite interactive hover:bg-muted hover:text-ink"
                >
                  View all
                </Link>
              </li>
            </ul>
          )}
        </nav>
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
        <div className={cn("border-t border-rule pt-2", isCollapsed && "flex justify-center")}>
          {userCard(isCollapsed)}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-dvh bg-paper">
      <a
        href="#main"
        className="sr-only z-50 rounded-sm bg-ink px-4 py-2 text-body text-paper shadow-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      {/* Desktop sidebar (≥1024). The width snaps; no width animation. */}
      <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-rule bg-subtle lg:flex">
        <div
          className={cn(
            "flex h-14 shrink-0 items-center px-3",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          {collapsed ? <LogoMark /> : <Logo />}
          {!collapsed && (
            <SidebarCollapseToggle
              collapsed={collapsed}
              onCollapsedChange={(c) => setStoredCollapsed(c)}
            />
          )}
        </div>
        <Sidebar
          collapsed={collapsed}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto bg-transparent pt-1",
            !collapsed && "w-[248px]",
          )}
        >
          {collapsed && (
            <SidebarCollapseToggle
              collapsed={collapsed}
              onCollapsedChange={(c) => setStoredCollapsed(c)}
            />
          )}
          {sidebarBody(collapsed)}
        </Sidebar>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-rule bg-paper/90 px-3 backdrop-blur md:px-6">
          <IconButton
            icon={Menu}
            aria-label="Open navigation"
            className="lg:hidden"
            onClick={() => setDrawerOpen(true)}
          />
          <p className="min-w-0 flex-1 truncate text-h3 md:hidden">{title}</p>
          <div className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
            <BreadcrumbSwitcher segments={[{ label: workspaceName }, { label: title }]} />
            <span aria-hidden className="mx-1 h-4 w-px bg-rule" />
            <LevelSwitch level={user.level} />
          </div>

          <IconButton
            icon={Search}
            aria-label="Search"
            shortcut={["mod", "K"]}
            className="lg:hidden"
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

        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {/^\/app\/notebooks\/[^/]+$/.test(pathname) ? (
            // A notebook is a full-height workspace (sources · chat · canvas), not a page.
            <div className="h-[calc(100dvh-3.5rem)] min-h-0">{children}</div>
          ) : (
            <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-28 md:px-8 md:pb-16">
              {children}
            </div>
          )}
        </main>
      </div>

      {/* Under 1024 the sidebar is a drawer. */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" title="Navigation">
          <Sidebar className="w-full bg-transparent p-0">
            {sidebarBody(false, () => setDrawerOpen(false))}
          </Sidebar>
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

      <NotebookDialog
        open={newNotebookOpen}
        onOpenChange={setNewNotebookOpen}
        onSaved={(notebook) => router.push(`/app/notebooks/${notebook.id}`)}
      />
    </div>
  );
}

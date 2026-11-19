"use client";

import { ChevronRight, PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";
import { createContext, use, useId, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip } from "@/components/ui/tooltip";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { cn } from "@/lib/utils";

const SidebarContext = createContext({ collapsed: false });

/**
 * App sidebar: 272px, or 72px icons-only when collapsed. The width snaps between the two — no
 * width animation (skill 7.3) — and collapsed items keep their names in tooltips.
 */
export function Sidebar({
  collapsed = false,
  label = "Main",
  className,
  children,
}: {
  collapsed?: boolean;
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <SidebarContext value={{ collapsed }}>
      <nav
        aria-label={label}
        data-collapsed={collapsed}
        className={cn(
          "flex shrink-0 flex-col gap-6 bg-paper p-3",
          collapsed ? "w-[72px] items-center" : "w-[272px]",
          className,
        )}
      >
        {children}
      </nav>
    </SidebarContext>
  );
}

export function SidebarSection({ label, children }: { label?: string; children: ReactNode }) {
  const { collapsed } = use(SidebarContext);
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={label ? id : undefined}
      className="flex w-full flex-col gap-1"
    >
      {label &&
        (collapsed ? (
          <span id={id} className="sr-only">
            {label}
          </span>
        ) : (
          <SidebarSectionLabel id={id}>{label}</SidebarSectionLabel>
        ))}
      <ul className="flex flex-col gap-1">{children}</ul>
    </div>
  );
}

/** Sentence case, graphite, no caps or tracking. */
export function SidebarSectionLabel({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p className={cn("px-3 pb-1 text-small font-medium text-graphite", className)} {...props} />
  );
}

type SidebarNavItemProps = {
  icon: LucideIcon;
  label: string;
  href?: string;
  active?: boolean;
  count?: number;
  /** Shown in the tooltip when collapsed. */
  shortcut?: string[];
  onClick?: () => void;
  "data-force"?: string;
};

/** 36px row: icon, label, optional count. Active: cobalt-soft fill, 2px cobalt left edge. */
export function SidebarNavItem({
  icon: Icon,
  label,
  href = "#",
  active = false,
  count,
  shortcut,
  onClick,
  "data-force": force,
}: SidebarNavItemProps) {
  const { collapsed } = use(SidebarContext);
  const link = (
    <a
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      data-force={force}
      className={cn(
        "group relative flex h-9 items-center gap-3 rounded-sm px-3 text-body text-ink interactive hover:bg-cobalt-soft/50 active:scale-98",
        "before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-cobalt before:opacity-0",
        "aria-[current=page]:bg-cobalt-soft aria-[current=page]:font-medium aria-[current=page]:before:opacity-100",
        collapsed && "size-9 justify-center px-0",
      )}
    >
      <Icon
        aria-hidden
        className="size-4.5 shrink-0 text-graphite group-aria-[current=page]:text-ink"
      />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {count !== undefined && <Badge className="tabular-nums">{count}</Badge>}
        </>
      )}
    </a>
  );
  return (
    <li>
      {collapsed ? (
        <Tooltip label={label} shortcut={shortcut} side="right">
          {link}
        </Tooltip>
      ) : (
        link
      )}
    </li>
  );
}

/**
 * Collapsible group (chevron rotates; content expands with grid-template-rows 0fr → 1fr).
 * Remembers whether it is open in localStorage.
 */
export function SidebarGroup({
  id,
  icon: Icon,
  label,
  defaultOpen = true,
  children,
}: {
  id: string;
  icon: LucideIcon;
  label: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const { collapsed } = use(SidebarContext);
  const [open, setOpen] = usePersistentState(`tensorlm:sidebar-group:${id}`, defaultOpen);
  const regionId = useId();
  if (collapsed) return <>{children}</>;
  return (
    <li>
      <CollapsiblePrimitive.Root open={open} onOpenChange={setOpen}>
        <CollapsiblePrimitive.Trigger
          aria-controls={regionId}
          className="group flex h-9 w-full cursor-pointer items-center gap-3 rounded-sm px-3 text-body text-ink interactive hover:bg-cobalt-soft/50 active:scale-98"
        >
          <Icon aria-hidden className="size-4.5 shrink-0 text-graphite" />
          <span className="flex-1 truncate text-left">{label}</span>
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 text-graphite transition-transform duration-(--dur-base) ease-out group-data-[state=open]:rotate-90"
          />
        </CollapsiblePrimitive.Trigger>
      </CollapsiblePrimitive.Root>
      <div
        id={regionId}
        data-state={open ? "open" : "closed"}
        inert={!open}
        className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-(--dur-base) ease-out data-[state=open]:grid-rows-[1fr]"
      >
        <ul className="flex min-h-0 flex-col gap-1 overflow-hidden pt-1 pl-6">{children}</ul>
      </div>
    </li>
  );
}

export function SidebarCollapseToggle({
  collapsed,
  onCollapsedChange,
}: {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  return (
    <IconButton
      icon={collapsed ? PanelLeftOpen : PanelLeftClose}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
      shortcut={["mod", "B"]}
      onClick={() => onCollapsedChange(!collapsed)}
    />
  );
}

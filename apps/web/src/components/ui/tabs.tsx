"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

/**
 * Page tabs with a 2px cobalt underline that slides to the active tab using transform only
 * (--dur-base, --ease-out). Overflowing lists scroll sideways with faded edges.
 */
export function TabsList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;
    const update = () => {
      const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      list.dataset.overflow = String(list.scrollWidth > list.clientWidth);
      if (!active) {
        indicator.style.opacity = "0";
        return;
      }
      indicator.style.opacity = "1";
      indicator.style.transform = `translateX(${active.offsetLeft}px) scaleX(${active.offsetWidth})`;
    };
    update();
    const mutations = new MutationObserver(update);
    mutations.observe(list, { attributes: true, subtree: true, attributeFilter: ["data-state"] });
    const resize = new ResizeObserver(update);
    resize.observe(list);
    return () => {
      mutations.disconnect();
      resize.disconnect();
    };
  }, []);

  return (
    <TabsPrimitive.List
      ref={listRef}
      data-slot="tabs-list"
      className={cn(
        "relative flex [scrollbar-width:none] overflow-x-auto border-b border-rule data-[overflow=true]:fade-edges-x",
        className,
      )}
      {...props}
    >
      {children}
      <span
        ref={indicatorRef}
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-left bg-cobalt opacity-0 transition-transform duration-(--dur-base) ease-out"
      />
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & { "data-force"?: string }) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "flex h-10 shrink-0 cursor-pointer items-center gap-2 px-3 text-body font-medium whitespace-nowrap text-graphite outline-offset-[-2px] interactive hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 data-[state=active]:text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("pt-4 outline-offset-4", className)} {...props} />;
}

/** "● Indexing" style status inside a tab: dot + word, never the dot alone. */
export function TabStatus({
  tone = "cobalt",
  children,
}: {
  tone?: "cobalt" | "success" | "warning" | "danger";
  children: React.ReactNode;
}) {
  const dot = {
    cobalt: "bg-cobalt",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  }[tone];
  return (
    <span className="flex items-center gap-1 text-small font-normal text-graphite">
      <span aria-hidden className={cn("size-2 rounded-full", dot)} />
      {children}
    </span>
  );
}

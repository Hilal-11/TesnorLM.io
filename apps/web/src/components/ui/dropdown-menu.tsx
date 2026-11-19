"use client";

import { Check, ChevronRight, type LucideIcon } from "lucide-react";
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import { Kbd } from "@/components/ui/kbd";
import { usePortalContainer } from "@/components/ui/portal-container";
import { cn } from "@/lib/utils";

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;
export const DropdownMenuSub = MenuPrimitive.Sub;
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

/** Shared surface for menus, selects, popovers and comboboxes (sheet-2, r-md, shadow-2). */
export const menuSurface =
  "z-50 min-w-48 overflow-hidden rounded-md border border-rule bg-sheet-2 p-1 text-ink shadow-2 data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in";

/** Shared item row: 32px, r-sm, cobalt-soft when highlighted. */
export const menuItem =
  "relative flex h-8 w-full cursor-default items-center gap-2 rounded-sm px-2 text-body text-ink outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-cobalt-soft [&_svg]:size-4 [&_svg]:shrink-0";

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal container={usePortalContainer()}>
      <MenuPrimitive.Content
        data-slot="dropdown-menu"
        sideOffset={sideOffset}
        className={cn(
          menuSurface,
          "max-h-(--radix-dropdown-menu-content-available-height) origin-(--radix-dropdown-menu-content-transform-origin) overflow-y-auto",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

type ItemExtras = {
  icon?: LucideIcon;
  /** Shortcut keys shown on the right, e.g. ["mod", "N"]. */
  shortcut?: string[];
};

function ItemBody({ icon: Icon, shortcut, children }: ItemExtras & { children: React.ReactNode }) {
  return (
    <>
      {Icon && <Icon aria-hidden className="text-graphite" />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && <Kbd keys={shortcut} className="ml-auto" />}
    </>
  );
}

export function DropdownMenuItem({
  className,
  icon,
  shortcut,
  destructive,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item> & ItemExtras & { destructive?: boolean }) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        menuItem,
        destructive &&
          "text-danger-strong data-highlighted:bg-danger/12 [&_svg]:text-danger-strong!",
        className,
      )}
      {...props}
    >
      <ItemBody icon={icon} shortcut={shortcut}>
        {children}
      </ItemBody>
    </MenuPrimitive.Item>
  );
}

export function DropdownMenuCheckboxItem({
  className,
  shortcut,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.CheckboxItem> & Omit<ItemExtras, "icon">) {
  return (
    <MenuPrimitive.CheckboxItem className={cn(menuItem, "pl-8", className)} {...props}>
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <MenuPrimitive.ItemIndicator>
          <Check aria-hidden className="text-cobalt" />
        </MenuPrimitive.ItemIndicator>
      </span>
      <ItemBody shortcut={shortcut}>{children}</ItemBody>
    </MenuPrimitive.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem className={cn(menuItem, "pl-8", className)} {...props}>
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <MenuPrimitive.ItemIndicator>
          <span aria-hidden className="block size-2 rounded-full bg-cobalt" />
        </MenuPrimitive.ItemIndicator>
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </MenuPrimitive.RadioItem>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Label>) {
  return (
    <MenuPrimitive.Label
      className={cn("px-2 pt-2 pb-1 text-small font-medium text-graphite", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-rule", className)} {...props} />
  );
}

export function DropdownMenuSubTrigger({
  className,
  icon,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubTrigger> & { icon?: LucideIcon }) {
  return (
    <MenuPrimitive.SubTrigger
      className={cn(menuItem, "data-[state=open]:bg-cobalt-soft", className)}
      {...props}
    >
      <ItemBody icon={icon}>{children}</ItemBody>
      <ChevronRight aria-hidden className="ml-auto text-graphite" />
    </MenuPrimitive.SubTrigger>
  );
}

export function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubContent>) {
  return (
    <MenuPrimitive.Portal container={usePortalContainer()}>
      <MenuPrimitive.SubContent
        className={cn(
          menuSurface,
          "origin-(--radix-dropdown-menu-content-transform-origin)",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

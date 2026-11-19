"use client";

import { createContext, use } from "react";

/**
 * Where overlays (tooltips, menus, popovers, dialogs) portal to. Defaults to <body>. A themed
 * region (e.g. the `.dark` column of the component showcase) can provide itself so overlays opened
 * inside it inherit its theme tokens.
 */
const PortalContainerContext = createContext<HTMLElement | null>(null);

export const PortalContainerProvider = PortalContainerContext;

export function usePortalContainer() {
  return use(PortalContainerContext) ?? undefined;
}

"use client";

import { useSyncExternalStore } from "react";

/** True when the media query matches. Server render (and first hydration pass) returns `fallback`. */
export function useMediaQuery(query: string, fallback = false) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}

/** Desktop layouts start at 768px (skill 6.2). */
export const useIsDesktop = () => useMediaQuery("(min-width: 768px)", true);

"use client";

import { useSyncExternalStore } from "react";

/** True while the on-screen keyboard covers part of the page (visualViewport shrinks). */
export function useKeyboardOpen() {
  return useSyncExternalStore(
    (onChange) => {
      const vv = window.visualViewport;
      vv?.addEventListener("resize", onChange);
      return () => vv?.removeEventListener("resize", onChange);
    },
    () => {
      const vv = window.visualViewport;
      return vv ? window.innerHeight - vv.height > 150 : false;
    },
    () => false,
  );
}

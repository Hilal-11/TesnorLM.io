"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** True on macOS / iOS. Defaults to false (show "Ctrl") on the server and before hydration. */
export function useIsMac() {
  return useSyncExternalStore(
    noop,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}

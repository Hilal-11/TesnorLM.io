"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "tensorlm:persistent-state";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // private mode or blocked storage
  }
}

/**
 * useState that remembers its value in localStorage (per browser). Renders `initial` on the
 * server and during hydration, then the stored value.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const raw = useSyncExternalStore(
    (onChange) => {
      const handler = (e: Event) => {
        if (e instanceof StorageEvent ? e.key === key : (e as CustomEvent).detail === key) {
          onChange();
        }
      };
      window.addEventListener("storage", handler);
      window.addEventListener(EVENT, handler);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener(EVENT, handler);
      };
    },
    () => read(key),
    () => null,
  );

  let value = initial;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = initial;
    }
  }

  const setValue = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // storage unavailable: the change still applies to this render via the event below
      }
      window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
    },
    [key],
  );

  return [value, setValue] as const;
}

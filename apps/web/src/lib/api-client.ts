"use client";

import { toast } from "@/components/ui/toast";

/**
 * fetch for our API routes. On 401 it tells the person their session ended and offers to sign in
 * again, coming back to the same page.
 */
export async function apiFetch(input: string, init?: RequestInit) {
  const response = await fetch(input, init);
  if (response.status === 401) {
    const here = `${window.location.pathname}${window.location.search}`;
    toast.error("Your session ended. Sign in again.", {
      action: {
        label: "Sign in",
        // A full page load on purpose: it drops any client state from the ended session.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        onClick: () => window.location.assign(`/login?next=${encodeURIComponent(here)}`),
      },
      duration: 10_000,
    });
  }
  return response;
}

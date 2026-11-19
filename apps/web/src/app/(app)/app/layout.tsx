import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { requireOnboarded } from "@/lib/auth";
import { recentNotebooks } from "@/lib/notebooks/repo";
import { firstName } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { AppShell, type ShellUser } from "./_components/app-shell";
import { ShellSkeleton } from "./_components/shell-skeleton";

// Reads the session at request time, so it can't be an instant (prerendered) navigation.
export const instant = false;

/**
 * The signed-in app. The session is read inside a Suspense boundary (Cache Components); the proxy
 * already redirected signed-out requests, and requireOnboarded() checks again here.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <SignedInShell>{children}</SignedInShell>
    </Suspense>
  );
}

async function SignedInShell({ children }: { children: ReactNode }) {
  // Request time: the auth check reads the clock (token expiry), which can't be prerendered.
  await connection();
  const { user, profile } = await requireOnboarded();
  const name = profile.full_name || user.email?.split("@")[0] || "You";
  const shellUser: ShellUser = {
    id: user.id,
    email: user.email ?? "",
    name,
    firstName: firstName(profile.full_name),
    avatarUrl: profile.avatar_url,
    level: profile.level,
    plan: "Free",
  };
  const recent = await recentNotebooks(await createClient()).catch(() => []);
  return (
    <AppShell user={shellUser} recentNotebooks={recent}>
      {children}
    </AppShell>
  );
}

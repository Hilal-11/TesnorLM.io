import { Suspense, type ReactNode } from "react";
import { requireOnboarded } from "@/lib/auth";
import { firstName } from "@/lib/profile";
import { AppShell, type ShellUser } from "./_components/app-shell";
import { ShellSkeleton } from "./_components/shell-skeleton";

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
  return <AppShell user={shellUser}>{children}</AppShell>;
}

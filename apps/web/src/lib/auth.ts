import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { unauthorized } from "@/lib/errors";
import { getProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in person, verified with the auth server (getUser), or null. Cached per request.
 * Never use getSession() for authorization on the server.
 */
export const getOptionalUser = cache(async (): Promise<User | null> => {
  // Request time: the session check reads the clock (token expiry), which can't be prerendered
  // (Cache Components). Every page and route that needs the person goes through here.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});

/** For pages and layouts: redirects to /login?next=… when signed out. */
export async function requireUser(next?: string): Promise<User> {
  const user = await getOptionalUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

/** For the app shell: also sends people who haven't finished onboarding to /onboarding. */
export async function requireOnboarded(next?: string) {
  const user = await requireUser(next);
  const profile = await getProfile();
  if (!profile?.onboarding_done) redirect("/onboarding");
  return { user, profile };
}

/** For server actions and API routes: throws a 401 AppError instead of redirecting. */
export async function requireUserForApi(): Promise<User> {
  const user = await getOptionalUser();
  if (!user) throw unauthorized();
  return user;
}

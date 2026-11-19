/**
 * Shared setup for the RLS and database tests. They run against a SEPARATE Supabase project (or
 * the local stack from `npx supabase start`): TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY and
 * TEST_SUPABASE_SERVICE_ROLE_KEY, from the repo-root .env.test or the environment.
 */
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export const URL_ = process.env.TEST_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_ANON_KEY;
const SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !ANON || !SERVICE) {
  throw new Error(
    "RLS tests need TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY and TEST_SUPABASE_SERVICE_ROLE_KEY " +
      "in the repo-root .env.test or the environment (a separate test project or the local stack).",
  );
}
if (URL_ === process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error(
    "Refusing to run: TEST_SUPABASE_URL is the main project. Use a separate test project.",
  );
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
export const admin = createClient(URL_, SERVICE, opts);
export const anon = createClient(URL_, ANON, opts);

export type Person = { user: User; client: SupabaseClient; email: string };

/** A confirmed user, signed in with their own client (RLS applies). */
export async function person(label: string): Promise<Person> {
  const email = `rls-${label}-${randomUUID()}@example.com`;
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `RLS ${label.toUpperCase()}` },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const client = createClient(URL_!, ANON!, opts);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { user: data.user, client, email };
}

export const must = <T>(res: { data: T; error: unknown }): NonNullable<T> => {
  if (res.error) throw res.error;
  if (res.data === null || res.data === undefined) throw new Error("expected data, got none");
  return res.data as NonNullable<T>;
};

/** A 1536-dimension embedding pointing mostly along one axis, so searches are predictable. */
export const embedding = (axis = 0) =>
  JSON.stringify(Array.from({ length: 1536 }, (_, i) => (i === axis ? 1 : 0.001)));

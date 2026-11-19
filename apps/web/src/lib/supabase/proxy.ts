import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/public-env";

/**
 * Refreshes the Supabase session for this request and reports whether someone is signed in.
 * getClaims() verifies the JWT (never trust getSession() on the server). Returns the response
 * carrying any refreshed cookies plus the no-cache headers Supabase asks for.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    return { response, signedIn: false };
  }

  const supabase = createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  let signedIn = false;
  try {
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
  } catch {
    signedIn = false; // auth service unreachable: treat as signed out, pages stay safe
  }
  return { response, signedIn };
}

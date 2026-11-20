import { NextResponse, type NextRequest } from "next/server";
import { routeDecision } from "@/lib/route-guard";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Runs before matched requests: refreshes the session cookie and does the optimistic redirects
 * (protected pages → /login?next=…, auth pages → /app). Layouts, server actions and API routes
 * check the user again — the proxy is not the only guard.
 */
export async function proxy(request: NextRequest) {
  const { response, signedIn } = await updateSession(request);
  const decision = routeDecision(request.nextUrl.pathname, request.nextUrl.search, signedIn);
  if (!decision) return response;

  const redirect = NextResponse.redirect(new URL(decision.redirect, request.url));
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  const cacheControl = response.headers.get("cache-control");
  if (cacheControl) redirect.headers.set("cache-control", cacheControl);
  return redirect;
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|ttf|txt|xml|json|mjs)$).*)",
  ],
};

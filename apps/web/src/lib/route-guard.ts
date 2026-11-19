/** Pages a signed-in person shouldn't see. /reset-password is not here: it needs a session. */
export const AUTH_PAGES = ["/login", "/signup", "/verify", "/forgot-password"];

const isUnder = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

export const isProtectedPath = (pathname: string) =>
  isUnder(pathname, "/app") || isUnder(pathname, "/onboarding");

/**
 * Where to send a request before rendering, or null to continue. Pure, so it's unit-tested.
 * The onboarding check lives in the (app) layout, not here, to avoid a database call per request.
 */
export function routeDecision(
  pathname: string,
  search: string,
  signedIn: boolean,
): { redirect: string } | null {
  if (!signedIn && isProtectedPath(pathname)) {
    return { redirect: `/login?next=${encodeURIComponent(`${pathname}${search}`)}` };
  }
  if (signedIn && AUTH_PAGES.includes(pathname)) {
    return { redirect: "/app" };
  }
  return null;
}

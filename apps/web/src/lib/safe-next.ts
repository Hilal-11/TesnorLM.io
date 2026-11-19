/**
 * Returns a same-site relative path for post-login redirects, or `fallback`. Rejects absolute URLs,
 * protocol-relative paths (//evil.com), backslash tricks (/\evil.com), control characters and
 * anything that resolves to another origin — prevents open redirects.
 */
export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  if (!next) return fallback;
  let value = next.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const base = "http://tensorlm.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

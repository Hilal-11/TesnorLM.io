/**
 * Which social sign-ins the Supabase project has turned on (GET /auth/v1/settings, a public
 * endpoint). Buttons for providers that aren't enabled are never shown, so a project without
 * Google or GitHub configured (the local stack, a fresh project) has no dead-end buttons.
 */
export const SOCIAL_PROVIDERS = ["google", "github"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export async function fetchEnabledProviders(
  supabaseUrl: string,
  anonKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SocialProvider[]> {
  try {
    const res = await fetchImpl(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: anonKey },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { external?: Record<string, boolean> };
    return SOCIAL_PROVIDERS.filter((p) => body.external?.[p] === true);
  } catch {
    return []; // unreachable auth server: email sign-in still works
  }
}

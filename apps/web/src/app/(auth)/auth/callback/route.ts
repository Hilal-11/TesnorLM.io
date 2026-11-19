import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { publicEnv } from "@/lib/public-env";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

/** OAuth (Google, GitHub) and identity-linking return here with ?code=… */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const to = (path: string) => NextResponse.redirect(new URL(path, publicEnv.siteUrl));

  if (!code) {
    const reason = url.searchParams.get("error_code") ?? url.searchParams.get("error") ?? "oauth";
    return to(`/auth/error?reason=${encodeURIComponent(reason)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    logger.warn("oauth exchange failed", { code: error?.code });
    return to("/auth/error?reason=oauth");
  }

  const provider = data.user.app_metadata?.provider;
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_done")
    .eq("id", data.user.id)
    .maybeSingle();
  if (provider === "google" || provider === "github") {
    await supabase
      .from("profiles")
      .update({ last_sign_in_method: provider })
      .eq("id", data.user.id);
  }
  return to(profile?.onboarding_done ? next : "/onboarding");
}

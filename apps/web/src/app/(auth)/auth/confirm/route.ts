import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { publicEnv } from "@/lib/public-env";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = [
  "email",
  "signup",
  "recovery",
  "email_change",
  "magiclink",
  "invite",
];

/** Email links (magic link, confirm signup, reset password, email change) land here. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const fallback = type === "recovery" ? "/reset-password" : "/app";
  const next = safeNext(url.searchParams.get("next"), fallback);
  const to = (path: string) => NextResponse.redirect(new URL(path, publicEnv.siteUrl));

  if (!tokenHash || !type || !TYPES.includes(type)) return to("/auth/error?reason=link");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return to(`/auth/error?reason=${error.code === "otp_expired" ? "expired" : "link"}`);
  }
  return to(next);
}

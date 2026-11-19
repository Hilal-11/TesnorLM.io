"use client";

import Script from "next/script";
import { publicEnv } from "@/lib/public-env";

/**
 * Cloudflare Turnstile bot check, only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. The widget puts
 * its token in a hidden "captchaToken" field, which the server action passes to Supabase.
 */
export function Turnstile() {
  if (!publicEnv.turnstileSiteKey) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <div
        className="cf-turnstile min-h-16"
        data-sitekey={publicEnv.turnstileSiteKey}
        data-response-field-name="captchaToken"
        data-theme="auto"
        data-size="flexible"
      />
    </>
  );
}

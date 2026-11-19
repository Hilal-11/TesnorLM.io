/**
 * Maps Supabase Auth errors to sentences in the product's voice (skill 9). Messages never reveal
 * whether an account exists for an email.
 */
type AuthErrorLike = { code?: string; status?: number; message?: string } | null | undefined;

export const AUTH_MESSAGES = {
  rateLimited: "Too many attempts. Try again in a minute.",
  badCredentials: "That email and password don't match. Try again, or email yourself a code.",
  badCode: "That code didn't work. Check the latest email or resend a new code.",
  expiredCode: "This code has expired. Send a new one.",
  weakPassword: "Choose a stronger password: at least 8 characters with a number or symbol.",
  captcha: "Complete the check below, then try again.",
  samePassword: "Choose a password you haven't used here before.",
  fallback: "We couldn't finish that. Check your connection and try again.",
} as const;

export function authErrorMessage(
  error: AuthErrorLike,
  context: "password" | "code" | "other" = "other",
) {
  if (!error) return AUTH_MESSAGES.fallback;
  const code = error.code ?? "";
  if (error.status === 429 || code.startsWith("over_") || code === "too_many_requests") {
    return AUTH_MESSAGES.rateLimited;
  }
  if (code === "captcha_failed") return AUTH_MESSAGES.captcha;
  if (code === "weak_password") return AUTH_MESSAGES.weakPassword;
  if (code === "same_password") return AUTH_MESSAGES.samePassword;
  if (code === "invalid_credentials" || (context === "password" && error.status === 400)) {
    return AUTH_MESSAGES.badCredentials;
  }
  if (context === "code" || code === "otp_expired" || code === "otp_disabled") {
    // Supabase reports wrong and expired codes with the same error.
    return /expired/i.test(error.message ?? "") && code !== "otp_expired"
      ? AUTH_MESSAGES.expiredCode
      : AUTH_MESSAGES.badCode;
  }
  return AUTH_MESSAGES.fallback;
}

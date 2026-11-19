"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authErrorMessage } from "@/lib/auth-errors";
import { AppError, defineAction, unauthorized } from "@/lib/errors";
import { logger, maskEmail } from "@/lib/logger";
import { publicEnv } from "@/lib/public-env";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";
import { clearVerifyFlow, readVerifyFlow, setVerifyFlow } from "@/lib/verify-flow";

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use 72 characters or fewer.")
  .regex(/[\d\W_]/, "Add a number or a symbol.");
const next = z
  .string()
  .optional()
  .transform((v) => safeNext(v));
const captchaToken = z.string().optional();

function captcha(token?: string) {
  return token ? { captchaToken: token } : {};
}

async function rememberMethod(method: "email" | "google" | "github") {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    await supabase.from("profiles").update({ last_sign_in_method: method }).eq("id", data.user.id);
  }
}

/** Where to go after signing in: onboarding until it's done, otherwise `next`. */
async function afterSignIn(nextPath: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_done")
    .eq("id", data.user.id)
    .maybeSingle();
  redirect(profile?.onboarding_done ? nextPath : "/onboarding");
}

// ───────────── Email + password ─────────────

export const signInWithPassword = defineAction(
  z.object({ email, password: z.string().min(1, "Enter your password."), next }),
  async (input) => {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (error) {
      if (error.code === "email_not_confirmed") {
        await supabase.auth.resend({ type: "signup", email: input.email });
        await setVerifyFlow({ email: input.email, flow: "signup", next: input.next });
        redirect("/verify");
      }
      logger.info("password sign-in failed", { email: maskEmail(input.email), code: error.code });
      throw new AppError("sign_in_failed", authErrorMessage(error, "password"), 400);
    }
    await rememberMethod("email");
    await afterSignIn(input.next);
  },
);

export const signUp = defineAction(
  z.object({
    full_name: z.string().trim().min(1, "Enter your name.").max(80),
    email,
    password,
    captchaToken,
  }),
  async (input) => {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${publicEnv.siteUrl}/auth/confirm?next=/onboarding`,
        data: { full_name: input.full_name },
        ...captcha(input.captchaToken),
      },
    });
    // Supabase answers an existing email with a normal-looking response; we do the same, so the
    // page never reveals whether an account exists.
    if (error && error.code !== "user_already_exists") {
      throw new AppError("sign_up_failed", authErrorMessage(error), 400);
    }
    await setVerifyFlow({ email: input.email, flow: "signup", next: "/onboarding" });
    redirect("/verify");
  },
);

// ───────────── 6-digit email code ─────────────

export const requestEmailCode = defineAction(
  z.object({ email, next, captchaToken }),
  async (input) => {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: input.email,
      options: { shouldCreateUser: false, ...captcha(input.captchaToken) },
    });
    // "Signups not allowed" means no account: answer the same way as success.
    if (error && error.code !== "otp_disabled" && error.code !== "signup_disabled") {
      if (error.status === 429 || error.code?.startsWith("over_")) {
        throw new AppError("rate_limited", authErrorMessage(error), 429);
      }
    }
    await setVerifyFlow({ email: input.email, flow: "email", next: input.next });
    redirect("/verify");
  },
);

export const verifyCode = defineAction(
  z.object({ token: z.string().regex(/^\d{6}$/, "Enter the 6-digit code.") }),
  async (input) => {
    const flow = await readVerifyFlow();
    if (!flow)
      throw new AppError("no_flow", "Start again: enter your email to get a new code.", 400);
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: flow.email,
      token: input.token,
      type: flow.flow === "signup" ? "signup" : "email",
    });
    if (error) throw new AppError("bad_code", authErrorMessage(error, "code"), 400);
    await clearVerifyFlow();
    await rememberMethod("email");
    await afterSignIn(flow.next);
  },
);

export const resendCode = defineAction(z.object({}), async () => {
  const flow = await readVerifyFlow();
  if (!flow) throw new AppError("no_flow", "Start again: enter your email to get a new code.", 400);
  const supabase = await createClient();
  const { error } =
    flow.flow === "signup"
      ? await supabase.auth.resend({ type: "signup", email: flow.email })
      : await supabase.auth.signInWithOtp({
          email: flow.email,
          options: { shouldCreateUser: false },
        });
  if (error && (error.status === 429 || error.code?.startsWith("over_"))) {
    throw new AppError("rate_limited", authErrorMessage(error), 429);
  }
  return { ok: true, message: "We sent a new code." };
});

export async function changeEmail() {
  const flow = await readVerifyFlow();
  await clearVerifyFlow();
  redirect(flow?.flow === "signup" ? "/signup" : "/login");
}

// ───────────── Password reset ─────────────

export const requestPasswordReset = defineAction(
  z.object({ email, captchaToken }),
  async (input) => {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo: `${publicEnv.siteUrl}/auth/confirm?type=recovery&next=/reset-password`,
      ...captcha(input.captchaToken),
    });
    if (error && (error.status === 429 || error.code?.startsWith("over_"))) {
      throw new AppError("rate_limited", authErrorMessage(error), 429);
    }
    return { ok: true, message: "If an account exists for this email, we've sent a reset link." };
  },
);

export const updatePassword = defineAction(z.object({ password }), async (input) => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw unauthorized("This reset link has expired. Request a new one.");
  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) throw new AppError("update_failed", authErrorMessage(error), 400);
  redirect("/app");
});

// ───────────── Google and GitHub ─────────────

export const signInWithProvider = defineAction(
  z.object({ provider: z.enum(["google", "github"]), next }),
  async (input) => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: input.provider,
      options: {
        redirectTo: `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(input.next)}`,
      },
    });
    if (error || !data.url) throw new AppError("oauth_failed", authErrorMessage(error), 400);
    redirect(data.url);
  },
);

// ───────────── Sign out ─────────────

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

/** Ends every session for this account, on every device. */
export async function signOutEverywhere() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}

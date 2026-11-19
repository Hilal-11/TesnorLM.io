import { describe, expect, it } from "vitest";
import { onboardingStepSchema } from "@/app/onboarding/schema";
import { AUTH_MESSAGES, authErrorMessage } from "@/lib/auth-errors";
import { profilePatchSchema } from "@/lib/profile";

describe("authErrorMessage", () => {
  it("rate limits read the same everywhere", () => {
    expect(authErrorMessage({ status: 429 })).toBe(AUTH_MESSAGES.rateLimited);
    expect(authErrorMessage({ code: "over_email_send_rate_limit" })).toBe(
      AUTH_MESSAGES.rateLimited,
    );
  });

  it("wrong password never says whether the email exists", () => {
    const message = authErrorMessage({ code: "invalid_credentials", status: 400 }, "password");
    expect(message).toBe(AUTH_MESSAGES.badCredentials);
    expect(message).not.toMatch(/no account|not found|doesn't exist/i);
  });

  it("codes and fallbacks follow the skill's words", () => {
    expect(authErrorMessage({ code: "otp_expired", status: 403 }, "code")).toBe(
      AUTH_MESSAGES.badCode,
    );
    expect(authErrorMessage({ code: "weak_password" })).toBe(AUTH_MESSAGES.weakPassword);
    expect(authErrorMessage({ code: "something_new" })).toBe(AUTH_MESSAGES.fallback);
    for (const message of Object.values(AUTH_MESSAGES)) {
      expect(message).not.toMatch(/oops|something went wrong/i);
    }
  });
});

describe("onboarding step schema", () => {
  it("accepts each step's answer", () => {
    expect(onboardingStepSchema.safeParse({ step: 1, role: "researcher" }).success).toBe(true);
    expect(onboardingStepSchema.safeParse({ step: 2, subjects: [] }).success).toBe(true);
    expect(onboardingStepSchema.safeParse({ step: 3, level: "expert" }).success).toBe(true);
    expect(onboardingStepSchema.safeParse({ step: 4, first_source: "sample" }).success).toBe(true);
  });

  it("rejects invalid input", () => {
    expect(onboardingStepSchema.safeParse({ step: 1, role: "admin" }).success).toBe(false);
    expect(onboardingStepSchema.safeParse({ step: 2, subjects: Array(9).fill("x") }).success).toBe(
      false,
    );
    expect(onboardingStepSchema.safeParse({ step: 3, level: "student" }).success).toBe(false);
    expect(onboardingStepSchema.safeParse({ step: 5 }).success).toBe(false);
    expect(onboardingStepSchema.safeParse({ step: 4, first_source: "https://evil" }).success).toBe(
      false,
    );
  });
});

describe("profile patch schema", () => {
  it("only allows settings fields", () => {
    expect(profilePatchSchema.safeParse({ level: "beginner" }).success).toBe(true);
    expect(profilePatchSchema.safeParse({ onboarding_done: true }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ id: "x" }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ full_name: "" }).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { AppError, defineAction, rateLimited, toErrorResponse } from "@/lib/errors";
import { readEnv } from "@/lib/env";
import { maskEmail, redact } from "@/lib/logger";
import { passwordStrength } from "@/lib/password-strength";
import { routeDecision } from "@/lib/route-guard";
import { safeNext } from "@/lib/safe-next";
import { z } from "zod";

describe("safeNext", () => {
  it.each([
    ["/app/notebooks?tab=sources#x", "/app/notebooks?tab=sources#x"],
    ["/onboarding", "/onboarding"],
    ["%2Fapp%2Fsettings", "/app/settings"],
  ])("keeps the relative path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "%2F%2Fevil.com",
    "javascript:alert(1)",
    "/app\nSet-Cookie:x",
    "app",
    "",
    null,
    undefined,
  ])("rejects %s", (input) => {
    expect(safeNext(input as string)).toBe("/app");
  });

  it("uses the given fallback", () => {
    expect(safeNext("https://evil.com", "/onboarding")).toBe("/onboarding");
  });
});

describe("routeDecision", () => {
  it("sends signed-out people to login, keeping where they were going", () => {
    expect(routeDecision("/app/notebooks", "?tab=1", false)).toEqual({
      redirect: "/login?next=%2Fapp%2Fnotebooks%3Ftab%3D1",
    });
    expect(routeDecision("/onboarding", "", false)?.redirect).toBe("/login?next=%2Fonboarding");
  });

  it("sends signed-in people away from auth pages", () => {
    for (const page of ["/login", "/signup", "/verify", "/forgot-password"]) {
      expect(routeDecision(page, "", true)).toEqual({ redirect: "/app" });
    }
  });

  it("lets everything else through", () => {
    expect(routeDecision("/app", "", true)).toBeNull();
    expect(routeDecision("/login", "", false)).toBeNull();
    expect(routeDecision("/reset-password", "", true)).toBeNull();
    expect(routeDecision("/application", "", false)).toBeNull();
    expect(routeDecision("/", "", false)).toBeNull();
  });
});

describe("passwordStrength", () => {
  it.each([
    ["short1", "Weak"],
    ["longenoughbutnodigits", "Weak"],
    ["password1", "Weak"],
    ["tensors42", "OK"],
    ["Attention-is-42", "Strong"],
  ])("%s is %s", (password, word) => {
    expect(passwordStrength(password).word).toBe(word);
  });

  it("reports each rule", () => {
    expect(passwordStrength("abc").rules).toEqual({ length: false, numberOrSymbol: false });
    expect(passwordStrength("abcdefg!").rules).toEqual({ length: true, numberOrSymbol: true });
  });
});

describe("logger redaction", () => {
  it("masks emails and redacts secrets, nested", () => {
    expect(maskEmail("hilal@gmail.com")).toBe("h***@gmail.com");
    expect(
      redact({
        user: "asha@example.com",
        nested: { password: "x", token: "y", list: [{ code: "123456" }], ok: 1 },
        markdown: "# secret paper",
      }),
    ).toEqual({
      user: "a***@example.com",
      nested: {
        password: "[redacted]",
        token: "[redacted]",
        list: [{ code: "[redacted]" }],
        ok: 1,
      },
      markdown: "[redacted]",
    });
  });
});

describe("errors", () => {
  it("AppError becomes its status and safe body", async () => {
    const res = toErrorResponse(rateLimited());
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: "Too many attempts. Try again in a minute.",
      code: "rate_limited",
    });
  });

  it("unknown errors become a 500 without details", async () => {
    const res = toErrorResponse(new Error("db password is hunter2"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("hunter2");
  });

  it("defineAction validates input and maps AppError", async () => {
    const action = defineAction(
      z.object({ email: z.email("Enter a valid email.") }),
      async ({ email }) => {
        if (email === "taken@example.com") throw new AppError("taken", "Use another email.");
        return { ok: true, message: email };
      },
    );
    const form = new FormData();
    form.set("email", "nope");
    expect(await action(null, form)).toMatchObject({
      ok: false,
      code: "invalid_input",
      fieldErrors: { email: "Enter a valid email." },
    });
    expect(await action(null, { email: "taken@example.com" })).toEqual({
      ok: false,
      error: "Use another email.",
      code: "taken",
    });
    expect(await action(null, { email: "a@example.com" })).toEqual({
      ok: true,
      message: "a@example.com",
    });
  });
});

describe("readEnv", () => {
  it("names missing and invalid variables without printing values", () => {
    expect(() =>
      readEnv("worker", { WORKER_URL: "http://localhost:8000", WORKER_SECRET: "abcd" }),
    ).toThrow(/WORKER_SECRET \(must be at least 16 characters\)/);
    try {
      readEnv("worker", { WORKER_SECRET: "abcd" });
    } catch (err) {
      expect(String(err)).toContain("WORKER_URL (missing)");
      expect(String(err)).not.toContain("abcd");
    }
  });

  it("parses a valid set with defaults", () => {
    expect(readEnv("ai", { ANTHROPIC_API_KEY: "k", OPENAI_API_KEY: "k" })).toMatchObject({
      EMBEDDING_MODEL: "text-embedding-3-small",
    });
  });
});

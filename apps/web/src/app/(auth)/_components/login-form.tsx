"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { safeNext } from "@/lib/safe-next";
import { requestEmailCode, signInWithPassword } from "../actions";
import { AuthCard, FormError, OrDivider } from "./auth-card";
import { LAST_METHOD_KEY, OAuthButtons, type AuthMethod } from "./oauth-buttons";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Google · GitHub · or email → Continue → password (or "Email me a code instead"). */
export function LoginForm() {
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");
  const [emailError, setEmailError] = useState<string>();
  const [, setLastMethod] = usePersistentState<AuthMethod | null>(LAST_METHOD_KEY, null);
  const [state, signIn, signingIn] = useActionState(signInWithPassword, null);
  const [codeState, requestCode, requestingCode] = useActionState(requestEmailCode, null);
  const error =
    (state && !state.ok && state.error) || (codeState && !codeState.ok && codeState.error);

  return (
    <AuthCard
      title="Sign in to TensorLM"
      subtitle="Welcome back! Sign in to continue learning."
      footer={
        <>
          New to TensorLM?{" "}
          <Link
            href="/signup"
            className="font-medium text-ink underline decoration-rule-strong underline-offset-2 hover:decoration-ink"
          >
            Create an account
          </Link>
        </>
      }
    >
      <OAuthButtons next={next} />
      <OrDivider />

      {step === "email" ? (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!EMAIL.test(email.trim())) {
              setEmailError("Enter a valid email address.");
              return;
            }
            setEmailError(undefined);
            setStep("password");
          }}
        >
          <Field label="Email" error={emailError}>
            <Input
              name="email"
              type="email"
              autoComplete="email"
              size="lg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" className="w-full">
            Continue
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2 rounded-sm bg-muted px-3 py-2">
            <span className="min-w-0 truncate text-body text-ink">{email.trim()}</span>
            <Button variant="link" size="sm" onClick={() => setStep("email")}>
              Change
            </Button>
          </div>
          <form
            action={signIn}
            onSubmit={() => setLastMethod("email")}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="email" value={email.trim()} />
            <input type="hidden" name="next" value={next} />
            <Field
              label="Password"
              error={state && !state.ok ? state.fieldErrors?.password : undefined}
            >
              <Input
                name="password"
                type="password"
                autoComplete="current-password"
                size="lg"
                autoFocus
              />
            </Field>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={signingIn}
              disabled={requestingCode}
            >
              Sign in
            </Button>
          </form>
          <FormError message={error || null} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <form action={requestCode} onSubmit={() => setLastMethod("email")}>
              <input type="hidden" name="email" value={email.trim()} />
              <input type="hidden" name="next" value={next} />
              <Button
                variant="link"
                size="sm"
                type="submit"
                loading={requestingCode}
                disabled={signingIn}
              >
                Email me a code instead
              </Button>
            </form>
            <Link
              href="/forgot-password"
              className="text-small font-medium text-ink underline decoration-rule-strong underline-offset-2 hover:decoration-ink"
            >
              Forgot password?
            </Link>
          </div>
        </div>
      )}
    </AuthCard>
  );
}

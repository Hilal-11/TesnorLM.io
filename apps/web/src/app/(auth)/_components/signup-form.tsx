"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Turnstile } from "@/components/turnstile";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { signUp } from "../actions";
import { AuthCard, FormError } from "./auth-card";
import { LAST_METHOD_KEY, OAuthButtons, type AuthMethod } from "./oauth-buttons";
import { PasswordField } from "./password-field";

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, null);
  const [, setLastMethod] = usePersistentState<AuthMethod | null>(LAST_METHOD_KEY, null);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <AuthCard
      title="Create your account"
      subtitle="Upload a paper and understand it, with diagrams and citations."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-ink underline decoration-rule-strong underline-offset-2 hover:decoration-ink"
          >
            Sign in
          </Link>
        </>
      }
    >
      <OAuthButtons next="/onboarding" />
      <form action={action} onSubmit={() => setLastMethod("email")} className="flex flex-col gap-4">
        <Field label="Name" error={fieldErrors?.full_name} required>
          <Input name="full_name" autoComplete="name" size="lg" />
        </Field>
        <Field label="Email" error={fieldErrors?.email} required>
          <Input name="email" type="email" autoComplete="email" size="lg" />
        </Field>
        <PasswordField autoComplete="new-password" showStrength error={fieldErrors?.password} />
        <Turnstile />
        <FormError message={state && !state.ok && !fieldErrors ? state.error : null} />
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}

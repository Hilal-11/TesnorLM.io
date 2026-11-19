"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Turnstile } from "@/components/turnstile";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestPasswordReset, updatePassword } from "../actions";
import { AuthCard, FormError } from "./auth-card";
import { PasswordField } from "./password-field";

const backToSignIn = (
  <Link
    href="/login"
    className="font-medium text-ink underline decoration-rule-strong underline-offset-2 hover:decoration-ink"
  >
    Back to sign in
  </Link>
);

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  if (state?.ok) {
    return (
      <AuthCard title="Check your email" footer={backToSignIn}>
        <p role="status" className="flex items-start gap-2 text-body text-ink">
          <CircleCheck aria-hidden className="mt-1 size-4 shrink-0 text-success-strong" />
          {state.message}
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={backToSignIn}
    >
      <form action={action} className="flex flex-col gap-4">
        <Field
          label="Email"
          error={state && !state.ok ? state.fieldErrors?.email : undefined}
          required
        >
          <Input name="email" type="email" autoComplete="email" size="lg" autoFocus />
        </Field>
        <Turnstile />
        <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <AuthCard title="Choose a new password" subtitle="You'll stay signed in on this device.">
      <form action={action} className="flex flex-col gap-4">
        <PasswordField
          label="New password"
          autoComplete="new-password"
          showStrength
          autoFocus
          error={state && !state.ok ? state.fieldErrors?.password : undefined}
        />
        <FormError message={state && !state.ok && !state.fieldErrors ? state.error : null} />
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Save new password
        </Button>
      </form>
    </AuthCard>
  );
}

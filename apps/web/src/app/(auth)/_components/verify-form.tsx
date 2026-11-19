"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { changeEmail, resendCode, verifyCode } from "../actions";
import { AuthCard, FormError } from "./auth-card";

const RESEND_SECONDS = 30;

/** Six boxes; submits when the code is complete. "Resend in 0:30", then "Resend code". */
export function VerifyForm({ maskedEmail }: { maskedEmail: string }) {
  const [code, setCode] = useState("");
  const [state, verify, verifying] = useActionState(verifyCode, null);
  const [resendState, resend, resending] = useActionState(resendCode, null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const formRef = useRef<HTMLFormElement>(null);
  const [seenResend, setSeenResend] = useState(resendState);

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  if (resendState !== seenResend) {
    setSeenResend(resendState);
    if (resendState?.ok) setSecondsLeft(RESEND_SECONDS);
  }

  const error =
    (state && !state.ok && (state.fieldErrors?.token ?? state.error)) ||
    (resendState && !resendState.ok && resendState.error) ||
    null;

  return (
    <AuthCard
      title="Check your email"
      subtitle={
        <>
          We sent a 6-digit code to <span className="font-medium text-ink">{maskedEmail}</span>.
        </>
      }
    >
      <form ref={formRef} action={verify} className="flex flex-col gap-4">
        <OtpInput
          name="token"
          value={code}
          onChange={setCode}
          onComplete={() => queueMicrotask(() => formRef.current?.requestSubmit())}
          invalid={Boolean(state && !state.ok)}
          disabled={verifying}
          autoFocus
        />
        <FormError message={error} />
        {resendState?.ok && (
          <p className="text-small text-graphite" role="status">
            {resendState.message}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={verifying}
          disabled={code.length < 6}
        >
          Verify
        </Button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <form action={resend}>
          <Button
            variant="link"
            size="sm"
            type="submit"
            loading={resending}
            disabled={secondsLeft > 0}
            className="disabled:text-graphite disabled:opacity-100"
          >
            {secondsLeft > 0
              ? `Resend in 0:${String(secondsLeft).padStart(2, "0")}`
              : "Resend code"}
          </Button>
        </form>
        <form action={changeEmail}>
          <Button variant="link" size="sm" type="submit">
            Change email
          </Button>
        </form>
      </div>
    </AuthCard>
  );
}

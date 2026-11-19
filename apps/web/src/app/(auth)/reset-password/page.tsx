import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getOptionalUser } from "@/lib/auth";
import { AuthCard } from "../_components/auth-card";
import { AuthCardSkeleton } from "../_components/auth-card-skeleton";
import { ResetPasswordForm } from "../_components/password-reset-forms";

// Reads the session at request time, so it can't be an instant (prerendered) navigation.
export const instant = false;

export const metadata: Metadata = { title: "Choose a new password" };

/** Only works with the recovery session the email link creates. */
async function Reset() {
  const user = await getOptionalUser();
  if (!user) {
    return (
      <AuthCard
        title="This reset link has expired"
        subtitle="Links work once and for a limited time. Request a new one."
        footer={
          <Link
            href="/forgot-password"
            className="font-medium text-ink underline decoration-rule-strong underline-offset-2 hover:decoration-ink"
          >
            Request a new link
          </Link>
        }
      >
        <p className="text-body text-graphite">
          Open the newest email if you asked more than once.
        </p>
      </AuthCard>
    );
  }
  return <ResetPasswordForm />;
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <Reset />
    </Suspense>
  );
}

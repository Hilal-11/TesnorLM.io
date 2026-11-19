import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { maskEmail } from "@/lib/logger";
import { readVerifyFlow } from "@/lib/verify-flow";
import { AuthCard } from "../_components/auth-card";
import { AuthCardSkeleton } from "../_components/auth-card-skeleton";
import { VerifyForm } from "../_components/verify-form";

// Reads the session at request time, so it can't be an instant (prerendered) navigation.
export const instant = false;

export const metadata: Metadata = { title: "Check your email" };

async function Verify() {
  const flow = await readVerifyFlow();
  if (!flow) {
    return (
      <AuthCard
        title="Your code has expired"
        subtitle="Enter your email again and we'll send a new code."
        footer={
          <Link
            href="/login"
            className="font-medium text-ink underline decoration-rule-strong underline-offset-2 hover:decoration-ink"
          >
            Back to sign in
          </Link>
        }
      >
        <p className="text-body text-graphite">Codes work for 30 minutes on this device.</p>
      </AuthCard>
    );
  }
  return <VerifyForm maskedEmail={maskEmail(flow.email)} />;
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <Verify />
    </Suspense>
  );
}

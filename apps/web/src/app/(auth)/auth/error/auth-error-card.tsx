"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuthCard } from "../../_components/auth-card";

const REASONS: Record<string, { title: string; body: string }> = {
  expired: {
    title: "This link has expired",
    body: "Email links work once and for a limited time. Sign in again to get a new one.",
  },
  link: {
    title: "This link didn't work",
    body: "It may have been used already or copied only in part. Sign in again to get a new one.",
  },
  access_denied: {
    title: "Sign-in was cancelled",
    body: "You can try again, or use your email instead.",
  },
  oauth: {
    title: "We couldn't finish signing you in",
    body: "The provider didn't confirm your account. Try again, or use your email instead.",
  },
};

export function AuthErrorCard() {
  const reason = useSearchParams().get("reason") ?? "oauth";
  const { title, body } = REASONS[reason] ?? REASONS.oauth;
  return (
    <AuthCard title={title}>
      <p className="text-body text-graphite">{body}</p>
      <Button asChild size="lg" className="w-full">
        <Link href="/login">Back to sign in</Link>
      </Button>
    </AuthCard>
  );
}

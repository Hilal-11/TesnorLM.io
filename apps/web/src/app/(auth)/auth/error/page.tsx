import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCardSkeleton } from "../../_components/auth-card-skeleton";
import { AuthErrorCard } from "./auth-error-card";

export const metadata: Metadata = { title: "Couldn't sign you in" };

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <AuthErrorCard />
    </Suspense>
  );
}

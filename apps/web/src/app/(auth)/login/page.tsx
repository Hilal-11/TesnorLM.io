import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCardSkeleton } from "../_components/auth-card-skeleton";
import { LoginForm } from "../_components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

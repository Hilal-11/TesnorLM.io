import "server-only";
import { cookies } from "next/headers";
import { safeNext } from "@/lib/safe-next";

/** Which email is waiting for a 6-digit code, kept in a short-lived httpOnly cookie (not the URL). */
const VERIFY_COOKIE = "tensorlm-verify";
export type VerifyFlow = { email: string; flow: "signup" | "email"; next: string };

export async function setVerifyFlow(flow: VerifyFlow) {
  (await cookies()).set(VERIFY_COOKIE, JSON.stringify(flow), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 30,
  });
}

export async function readVerifyFlow(): Promise<VerifyFlow | null> {
  const raw = (await cookies()).get(VERIFY_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as VerifyFlow;
    if (typeof parsed.email !== "string") return null;
    return { ...parsed, next: safeNext(parsed.next) };
  } catch {
    return null;
  }
}

export async function clearVerifyFlow() {
  (await cookies()).delete(VERIFY_COOKIE);
}

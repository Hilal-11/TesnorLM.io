import type { ReactNode } from "react";

/** Auth pages: one calm, centred card on paper (skill: centre single-action pages only). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-paper px-4 py-12">
      {children}
      <p className="max-w-[400px] text-center text-small text-graphite">
        By continuing you agree to the{" "}
        <a href="/terms" className="text-ink underline underline-offset-2 hover:text-cobalt">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="text-ink underline underline-offset-2 hover:text-cobalt">
          Privacy Policy
        </a>
        .
      </p>
    </main>
  );
}

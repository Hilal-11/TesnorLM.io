import type { ReactNode } from "react";

/** Auth pages: one calm, centred card on paper (skill: centre single-action pages only). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-subtle px-4 py-12 dark:bg-paper">
      {children}
      <p className="max-w-[400px] text-center text-caption text-graphite">
        By continuing you agree to the{" "}
        <a
          href="/terms"
          className="text-ink underline decoration-rule-strong underline-offset-2 hover:decoration-ink"
        >
          Terms
        </a>{" "}
        and{" "}
        <a
          href="/privacy"
          className="text-ink underline decoration-rule-strong underline-offset-2 hover:decoration-ink"
        >
          Privacy Policy
        </a>
        .
      </p>
    </main>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "../../(app)/app/_components/app-shell";
import { HomeDashboard } from "../../(app)/app/_components/home-dashboard";

export const metadata: Metadata = { title: "Shell preview" };

/** Dev only: the signed-in shell and Home with a sample person, for design review and axe. */
export default function AppShellPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <AppShell
      previewPath="/app"
      user={{
        id: "preview",
        email: "asha.rao@example.com",
        name: "Asha Rao",
        firstName: "Asha",
        avatarUrl: null,
        level: "intermediate",
        plan: "Free",
      }}
    >
      <HomeDashboard firstName="Asha" level="intermediate" />
    </AppShell>
  );
}

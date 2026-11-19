import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { PageHeader } from "../_components/page-header";
import { SettingsView, type LinkedIdentity } from "./settings-view";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS = [
  ["Profile", "profile"],
  ["Preferences", "preferences"],
  ["Linked accounts", "linked-accounts"],
  ["Sessions", "sessions"],
] as const;

export default async function SettingsPage() {
  const user = await requireUser("/app/settings");
  const profile = await getProfile();
  const identities: LinkedIdentity[] = (user.identities ?? []).map((i) => ({
    identity_id: i.identity_id,
    id: i.id,
    user_id: i.user_id,
    provider: i.provider,
    email: (i.identity_data?.email as string | undefined) ?? null,
  }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Your profile, how TensorLM explains things, and how you sign in."
      />
      <div className="grid gap-10 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-20 flex flex-col gap-0.5 border-l border-rule">
            {SECTIONS.map(([label, id]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="-ml-px flex h-8 items-center border-l border-transparent pl-3 text-body text-graphite hover:border-ink hover:text-ink"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex max-w-3xl min-w-0 flex-col gap-12">
          <SettingsView
            email={user.email ?? ""}
            fullName={profile?.full_name ?? ""}
            avatarUrl={profile?.avatar_url ?? null}
            level={profile?.level ?? "intermediate"}
            identities={identities}
          />
        </div>
      </div>
    </div>
  );
}

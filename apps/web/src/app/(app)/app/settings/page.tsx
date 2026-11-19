import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { PageHeader } from "../_components/page-header";
import { SettingsView, type LinkedIdentity } from "./settings-view";

export const metadata: Metadata = { title: "Settings" };

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
    <div className="flex max-w-3xl flex-col gap-12">
      <PageHeader
        title="Settings"
        description="Your profile, how TensorLM explains things, and how you sign in."
      />
      <SettingsView
        email={user.email ?? ""}
        fullName={profile?.full_name ?? ""}
        avatarUrl={profile?.avatar_url ?? null}
        level={profile?.level ?? "intermediate"}
        identities={identities}
      />
    </div>
  );
}

"use client";

import type { UserIdentity } from "@supabase/supabase-js";
import { Laptop, Mail, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useTransition } from "react";
import { GitHubIcon, GoogleIcon } from "@/components/brand-icons";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsGroup, SettingsItem } from "@/components/ui/settings-group";
import { SettingsSection } from "@/components/ui/settings-section";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { publicEnv } from "@/lib/public-env";
import { createClient } from "@/lib/supabase/client";
import { signOutEverywhere } from "../../../(auth)/actions";
import { updateProfile } from "../../../actions/profile";

export type LinkedIdentity = Pick<UserIdentity, "identity_id" | "id" | "user_id" | "provider"> & {
  email: string | null;
};

type Level = "beginner" | "intermediate" | "expert";

const PROVIDERS = [
  { id: "google", name: "Google", icon: <GoogleIcon className="size-5" /> },
  { id: "github", name: "GitHub", icon: <GitHubIcon className="size-5 text-ink" /> },
] as const;

/** Only one way left to sign in: it can't be removed (you'd be locked out). */
export function canUnlink(identities: { provider: string }[]) {
  return identities.length > 1;
}

export function SettingsView({
  email,
  fullName,
  avatarUrl,
  level,
  identities,
}: {
  email: string;
  fullName: string;
  avatarUrl: string | null;
  level: Level;
  identities: LinkedIdentity[];
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(fullName);
  const [savedName, setSavedName] = useState(fullName);
  const [pending, startTransition] = useTransition();
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  const save = (patch: Parameters<typeof updateProfile>[1]) =>
    startTransition(async () => {
      const result = await updateProfile(null, patch);
      if (result?.ok) toast.success("Saved");
      else if (result)
        toast.error("Couldn't save", {
          description: result.fieldErrors?.full_name ?? result.error,
        });
    });

  async function link(provider: "google" | "github") {
    setBusyProvider(provider);
    const { error } = await createClient().auth.linkIdentity({
      provider,
      options: { redirectTo: `${publicEnv.siteUrl}/auth/callback?next=/app/settings` },
    });
    if (error) {
      setBusyProvider(null);
      toast.error(`Couldn't connect ${provider === "google" ? "Google" : "GitHub"}`, {
        description: "Turn on manual linking in Supabase, or try again in a minute.",
      });
    }
  }

  async function unlink(identity: LinkedIdentity, label: string) {
    setBusyProvider(identity.provider);
    const { error } = await createClient().auth.unlinkIdentity(identity as unknown as UserIdentity);
    setBusyProvider(null);
    if (error)
      toast.error(`Couldn't disconnect ${label}`, { description: "Try again in a minute." });
    else {
      toast.success(`${label} disconnected`);
      router.refresh();
    }
  }

  const unlinkable = canUnlink(identities);
  const emailIdentity = identities.find((i) => i.provider === "email");

  return (
    <>
      <SettingsSection id="profile" title="Profile" description="How you appear in TensorLM.">
        <SettingsGroup>
          <div className="flex flex-wrap items-start gap-4 p-4">
            <Avatar name={name || email} src={avatarUrl ?? undefined} size={40} />
            <div className="flex min-w-60 flex-1 flex-col gap-4">
              <Field label="Name" helper="Saves when you leave the field.">
                <Input
                  value={name}
                  autoComplete="name"
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => {
                    if (name.trim() && name.trim() !== savedName) {
                      setSavedName(name.trim());
                      save({ full_name: name.trim() });
                    }
                  }}
                />
              </Field>
              <Field label="Email" helper="Your sign-in email. Contact us to change it.">
                <Input value={email} readOnly />
              </Field>
            </div>
          </div>
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection
        id="preferences"
        title="Preferences"
        description="Changes save as you make them."
      >
        <SettingsGroup>
          <SettingsItem
            label="Explanation level"
            description="How answers are pitched unless you ask otherwise."
          >
            <Select
              defaultValue={level}
              onValueChange={(v) => save({ level: v as Level })}
              disabled={pending}
            >
              <SelectTrigger aria-label="Explanation level" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
              </SelectContent>
            </Select>
          </SettingsItem>
          <SettingsItem label="Theme" description="System follows your device.">
            <SegmentedControl
              aria-label="Theme"
              value={theme ?? "system"}
              onValueChange={setTheme}
              options={[
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "System", icon: Laptop },
              ]}
            />
          </SettingsItem>
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection
        id="linked-accounts"
        title="Linked accounts"
        description="Sign in with any connected method; they all open the same account."
      >
        <SettingsGroup>
          {emailIdentity && (
            <SettingsItem
              icon={<Mail aria-hidden className="size-5 text-graphite" />}
              label="Email"
              description={email}
            >
              <Badge variant="success">Connected</Badge>
            </SettingsItem>
          )}
          {PROVIDERS.map(({ id, name: label, icon }) => {
            const identity = identities.find((i) => i.provider === id);
            return (
              <SettingsItem
                key={id}
                icon={icon}
                label={label}
                description={
                  identity
                    ? (identity.email ?? "Connected")
                    : `Sign in with ${label} as well as your current method.`
                }
              >
                {identity ? (
                  <>
                    <Badge variant="success">Connected</Badge>
                    {unlinkable ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={busyProvider === id}
                        onClick={() => unlink(identity, label)}
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Tooltip label="This is your only way to sign in. Connect another method first.">
                        <Button variant="secondary" size="sm" aria-disabled>
                          Disconnect
                        </Button>
                      </Tooltip>
                    )}
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busyProvider === id}
                    onClick={() => link(id)}
                  >
                    Connect
                  </Button>
                )}
              </SettingsItem>
            );
          })}
        </SettingsGroup>
        {!unlinkable && (
          <p className="text-small text-graphite">
            You can&apos;t disconnect your only sign-in method. Connect another one first.
          </p>
        )}
      </SettingsSection>

      <SettingsSection id="sessions" title="Sessions" description="Where you're signed in.">
        <SettingsGroup>
          <SettingsItem
            label="Sign out of all devices"
            description="Ends every session, including this one. Use it if you signed in on a shared computer."
          >
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm">
                  Sign out everywhere
                </Button>
              </DialogTrigger>
              <DialogContent size="sm">
                <DialogHeader
                  title="Sign out of all devices?"
                  description="You'll be signed out on every phone, tablet and computer, including this one. This can't be undone."
                />
                <DialogBody>
                  <p className="text-body text-graphite">You can sign in again at any time.</p>
                </DialogBody>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary" data-autofocus>
                      Cancel
                    </Button>
                  </DialogClose>
                  <form action={signOutEverywhere}>
                    <Button type="submit" variant="danger">
                      Sign out everywhere
                    </Button>
                  </form>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </SettingsItem>
        </SettingsGroup>
      </SettingsSection>
    </>
  );
}

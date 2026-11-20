"use client";

import { useActionState, useEffect, useState } from "react";
import { GitHubIcon, GoogleIcon } from "@/components/brand-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { fetchEnabledProviders, type SocialProvider } from "@/lib/auth-providers";
import { publicEnv } from "@/lib/public-env";
import { signInWithProvider } from "../actions";
import { FormError, OrDivider } from "./auth-card";

export const LAST_METHOD_KEY = "tensorlm:last-auth-method";
export type AuthMethod = "google" | "github" | "email";

const PROVIDERS = [
  { id: "google", label: "Continue with Google", Icon: GoogleIcon },
  { id: "github", label: "Continue with GitHub", Icon: GitHubIcon },
] as const;

/**
 * Google and GitHub, full width, with the "or" divider below; the method used last time gets a
 * "Last used" badge. Only providers the Supabase project has turned on are shown (none: no
 * buttons and no divider, just email).
 */
export function OAuthButtons({ next }: { next?: string }) {
  const [lastMethod, setLastMethod] = usePersistentState<AuthMethod | null>(LAST_METHOD_KEY, null);
  const [state, action, pending] = useActionState(signInWithProvider, null);
  const [clicked, setClicked] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<SocialProvider[] | null>(null);

  useEffect(() => {
    let live = true;
    void fetchEnabledProviders(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey).then((list) => {
      if (live) setEnabled(list);
    });
    return () => {
      live = false;
    };
  }, []);

  const providers = PROVIDERS.filter((p) => enabled?.includes(p.id));
  if (providers.length === 0) return null;

  return (
    <>
      <form action={action} className="flex flex-col gap-3">
        {next && <input type="hidden" name="next" value={next} />}
        {providers.map(({ id, label, Icon }) => (
          <div key={id} className="relative">
            <Button
              type="submit"
              name="provider"
              value={id}
              variant="secondary"
              size="lg"
              className="w-full"
              loading={pending && clicked === id}
              disabled={pending && clicked !== id}
              onClick={() => {
                setClicked(id);
                setLastMethod(id);
              }}
            >
              <Icon className="size-4.5" />
              {label}
            </Button>
            {lastMethod === id && (
              <Badge
                variant="outline"
                className="pointer-events-none absolute -top-2.5 right-3 rounded-full shadow-1"
              >
                Last used
              </Badge>
            )}
          </div>
        ))}
        <FormError message={state && !state.ok ? state.error : null} />
      </form>
      <OrDivider />
    </>
  );
}

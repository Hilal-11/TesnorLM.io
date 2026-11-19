"use client";

import { useActionState, useState } from "react";
import { GitHubIcon, GoogleIcon } from "@/components/brand-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { signInWithProvider } from "../actions";
import { FormError } from "./auth-card";

export const LAST_METHOD_KEY = "tensorlm:last-auth-method";
export type AuthMethod = "google" | "github" | "email";

const PROVIDERS = [
  { id: "google", label: "Continue with Google", Icon: GoogleIcon },
  { id: "github", label: "Continue with GitHub", Icon: GitHubIcon },
] as const;

/** Google and GitHub, full width; the method used last time gets a "Last used" badge. */
export function OAuthButtons({ next }: { next?: string }) {
  const [lastMethod, setLastMethod] = usePersistentState<AuthMethod | null>(LAST_METHOD_KEY, null);
  const [state, action, pending] = useActionState(signInWithProvider, null);
  const [clicked, setClicked] = useState<string | null>(null);

  return (
    <form action={action} className="flex flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      {PROVIDERS.map(({ id, label, Icon }) => (
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
            <Badge variant="cobalt" className="pointer-events-none absolute -top-2.5 right-3">
              Last used
            </Badge>
          )}
        </div>
      ))}
      <FormError message={state && !state.ok ? state.error : null} />
    </form>
  );
}

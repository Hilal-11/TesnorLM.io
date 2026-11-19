import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderUI } from "@/test/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "system", setTheme: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {} }) }));
vi.mock("../../../(auth)/actions", () => ({ signOutEverywhere: vi.fn() }));
vi.mock("../../../actions/profile", () => ({ updateProfile: vi.fn() }));

const { SettingsView, canUnlink } = await import("./settings-view");

const identity = (provider: string) => ({
  identity_id: `${provider}-1`,
  id: `${provider}-id`,
  user_id: "u1",
  provider,
  email: "asha@example.com",
});

const props = {
  email: "asha@example.com",
  fullName: "Asha Rao",
  avatarUrl: null,
  level: "intermediate" as const,
};

describe("Linked accounts", () => {
  it("never allows removing the last sign-in method", () => {
    expect(canUnlink([identity("github")])).toBe(false);
    expect(canUnlink([identity("github"), identity("email")])).toBe(true);
  });

  it("disables Disconnect for the only method and explains why", () => {
    renderUI(<SettingsView {...props} identities={[identity("github")]} />);
    expect(screen.getByRole("button", { name: "Disconnect" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText(/can't disconnect your only sign-in method/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeEnabled(); // Google
  });

  it("allows Disconnect when another method remains", () => {
    renderUI(<SettingsView {...props} identities={[identity("github"), identity("google")]} />);
    for (const button of screen.getAllByRole("button", { name: "Disconnect" })) {
      expect(button).not.toHaveAttribute("aria-disabled");
    }
  });

  it("asks before signing out everywhere", async () => {
    const { user } = renderUI(<SettingsView {...props} identities={[identity("email")]} />);
    await user.click(screen.getByRole("button", { name: "Sign out everywhere" }));
    expect(
      await screen.findByRole("dialog", { name: "Sign out of all devices?" }),
    ).toBeInTheDocument();
  });
});

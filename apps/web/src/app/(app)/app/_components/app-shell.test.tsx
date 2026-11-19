import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoAxeViolations } from "@/test/axe";
import { renderUI } from "@/test/render";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/notebooks",
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", resolvedTheme: "light", setTheme: vi.fn() }),
}));
vi.mock("../../../(auth)/actions", () => ({ signOut: vi.fn() }));
vi.mock("../../../actions/profile", () => ({ updateProfile: vi.fn(async () => ({ ok: true })) }));

const { AppShell } = await import("./app-shell");

const user = {
  id: "user-1",
  email: "asha@example.com",
  name: "Asha Rao",
  firstName: "Asha",
  avatarUrl: null,
  level: "intermediate" as const,
  plan: "Free",
};

describe("AppShell", () => {
  beforeEach(() => push.mockReset());

  it("marks the current page in the sidebar and names the workspace", () => {
    renderUI(<AppShell user={user}>Page</AppShell>);
    const sidebar = screen.getAllByRole("navigation", { name: "Main" })[0];
    expect(within(sidebar).getByRole("link", { name: "Notebooks" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(sidebar).getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    expect(screen.getAllByText("Asha's workspace").length).toBeGreaterThan(0);
  });

  it("starts with a skip link to the content", async () => {
    const { user: u } = renderUI(<AppShell user={user}>Page</AppShell>);
    await u.tab();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveFocus();
  });

  it("Ctrl+B toggles the sidebar and remembers the choice", async () => {
    // jsdom reports a narrow screen (< 1280px), where the sidebar starts collapsed.
    const { user: u } = renderUI(<AppShell user={user}>Page</AppShell>);
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await u.keyboard("{Control>}b{/Control}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute(
        "aria-expanded",
        "true",
      ),
    );
    expect(window.localStorage.getItem("tensorlm:sidebar-collapsed:user-1")).toBe("false");
  });

  it("Ctrl+K opens the command palette, which navigates", async () => {
    const { user: u } = renderUI(<AppShell user={user}>Page</AppShell>);
    await u.keyboard("{Control>}k{/Control}");
    const palette = await screen.findByRole("dialog");
    await u.type(within(palette).getByRole("combobox"), "Settings");
    await u.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/app/settings");
  });

  it("has no axe violations", async () => {
    const { container } = renderUI(<AppShell user={user}>Page</AppShell>);
    await expectNoAxeViolations(container);
  });
});

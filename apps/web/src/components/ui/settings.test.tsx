import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CheckboxField } from "@/components/ui/checkbox";
import { SettingsGroup, SettingsRow, useAutoSave } from "@/components/ui/settings-group";
import { SettingsSection } from "@/components/ui/settings-section";
import { Toaster } from "@/components/ui/toast";
import { expectNoAxeViolations } from "@/test/axe";
import { renderUI } from "@/test/render";

function Diagrams({ save }: { save: (v: boolean) => Promise<void> }) {
  const autoSave = useAutoSave(save);
  return (
    <>
      <SettingsSection title="Learning" description="How TensorLM explains things to you.">
        <SettingsGroup title="Diagrams">
          <SettingsRow
            label="Show diagrams automatically"
            description="Draw a diagram when an answer explains a process or structure."
            onCheckedChange={autoSave}
          >
            <CheckboxField label="Animate the drawing" />
          </SettingsRow>
          <SettingsRow
            label="Quiz me after each answer"
            disabled
            disabledReason="Available on the Student plan"
          />
        </SettingsGroup>
      </SettingsSection>
      <Toaster />
    </>
  );
}

describe("SettingsRow", () => {
  it("the label toggles the switch and reveals nested options", async () => {
    const { user } = renderUI(<Diagrams save={() => Promise.resolve()} />);
    const toggle = screen.getByRole("switch", { name: "Show diagrams automatically" });
    const nested = screen.getByRole("checkbox", { name: "Animate the drawing" });
    const region = nested.closest('[data-slot="settings-sub-options"]');
    expect(region).toHaveAttribute("data-state", "closed");
    expect(nested.closest("[inert]")).not.toBeNull();

    await user.click(screen.getByText("Show diagrams automatically"));
    expect(toggle).toBeChecked();
    expect(nested.closest("[inert]")).toBeNull();
    expect(region).toHaveAttribute("data-state", "open");
  });

  it("a disabled row says why", () => {
    renderUI(<Diagrams save={() => Promise.resolve()} />);
    const toggle = screen.getByRole("switch", { name: "Quiz me after each answer" });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAccessibleDescription("Available on the Student plan");
  });

  it("auto-saves with a Saved toast", async () => {
    const save = vi.fn(() => Promise.resolve());
    const { user } = renderUI(<Diagrams save={save} />);
    await user.click(screen.getByRole("switch", { name: "Show diagrams automatically" }));
    expect(save).toHaveBeenCalledWith(true);
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("offers Try again when saving fails", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    const { user } = renderUI(<Diagrams save={save} />);
    await user.click(screen.getByRole("switch", { name: "Show diagrams automatically" }));
    expect(await screen.findByText("Couldn't save this setting")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(save).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = renderUI(<Diagrams save={() => Promise.resolve()} />);
    await expectNoAxeViolations(container);
  });
});

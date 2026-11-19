import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OtpInput } from "@/components/ui/otp-input";
import { expectNoAxeViolations } from "@/test/axe";
import { renderUI } from "@/test/render";

function Harness({ onComplete }: { onComplete?: (v: string) => void }) {
  const [value, setValue] = useState("");
  return <OtpInput value={value} onChange={setValue} onComplete={onComplete} name="token" />;
}

const box = (n: number) => screen.getByRole("textbox", { name: `Digit ${n} of 6` });

describe("OtpInput", () => {
  it("labels every box and asks for the numeric keyboard", () => {
    renderUI(<Harness />);
    for (let n = 1; n <= 6; n++) expect(box(n)).toHaveAttribute("inputmode", "numeric");
    expect(box(1)).toHaveAttribute("autocomplete", "one-time-code");
  });

  it("typing advances; the last digit completes the code", async () => {
    const onComplete = vi.fn();
    const { user } = renderUI(<Harness onComplete={onComplete} />);
    await user.click(box(1));
    await user.keyboard("12345");
    expect(box(6)).toHaveFocus();
    await user.keyboard("6");
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("pasting the whole code fills every box", async () => {
    const onComplete = vi.fn();
    const { user, container } = renderUI(<Harness onComplete={onComplete} />);
    await user.click(box(1));
    await user.paste("482 913");
    expect([1, 2, 3, 4, 5, 6].map((n) => (box(n) as HTMLInputElement).value).join("")).toBe(
      "482913",
    );
    expect(onComplete).toHaveBeenCalledWith("482913");
    expect(container.querySelector('input[type="hidden"][name="token"]')).toHaveValue("482913");
  });

  it("Backspace on an empty box clears the previous one and moves back", async () => {
    const { user } = renderUI(<Harness />);
    await user.click(box(1));
    await user.keyboard("12");
    expect(box(3)).toHaveFocus();
    await user.keyboard("{Backspace}");
    expect(box(2)).toHaveFocus();
    expect(box(2)).toHaveValue("");
  });

  it("ignores letters", async () => {
    const { user } = renderUI(<Harness />);
    await user.click(box(1));
    await user.keyboard("a");
    expect(box(1)).toHaveValue("");
  });

  it("has no axe violations", async () => {
    const { container } = renderUI(<Harness />);
    await expectNoAxeViolations(container);
  });
});

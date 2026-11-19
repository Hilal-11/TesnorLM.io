import { act, screen } from "@testing-library/react";
import { Plus, Upload } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { COPY_ERROR, CopyButton } from "@/components/ui/copy-button";
import { IconButton } from "@/components/ui/icon-button";
import { SplitButton } from "@/components/ui/split-button";
import { expectNoAxeViolations } from "@/test/axe";
import { renderUI } from "@/test/render";

const VARIANTS = ["primary", "dark", "secondary", "ghost", "danger", "link"] as const;

describe("Button", () => {
  it.each(VARIANTS)("renders the %s variant", (variant) => {
    renderUI(<Button variant={variant}>Add source</Button>);
    const button = screen.getByRole("button", { name: "Add source" });
    expect(button).toHaveAttribute("data-variant", variant);
    expect(button).toHaveAttribute("type", "button");
  });

  it("loading sets aria-busy, keeps the label and ignores clicks", async () => {
    const onClick = vi.fn();
    const { user } = renderUI(
      <Button loading onClick={onClick} leadingIcon={Upload}>
        Upload paper
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Upload paper" });
    expect(button).toHaveAttribute("aria-busy", "true");
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("disabled blocks clicks", async () => {
    const onClick = vi.fn();
    const { user } = renderUI(
      <Button disabled onClick={onClick}>
        Delete source
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Delete source" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("aria-disabled stays focusable but blocks clicks", async () => {
    const onClick = vi.fn();
    const { user } = renderUI(
      <Button aria-disabled onClick={onClick}>
        Export
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Export" });
    await user.tab();
    expect(button).toHaveFocus();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("asChild renders the child element with button styling", () => {
    renderUI(
      <Button asChild variant="secondary" leadingIcon={Plus}>
        <a href="/notebooks/new">New notebook</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "New notebook" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/notebooks/new");
    expect(link.querySelector("svg")).not.toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = renderUI(
      <div>
        {VARIANTS.map((v) => (
          <Button key={v} variant={v}>
            Add source
          </Button>
        ))}
        <Button loading>Saving</Button>
      </div>,
    );
    await expectNoAxeViolations(container);
  });
});

describe("IconButton", () => {
  it("requires an aria-label", () => {
    // @ts-expect-error aria-label is required for icon-only buttons
    const element = <IconButton icon={Plus} />;
    expect(element).toBeTruthy();
  });

  it("uses its label as the accessible name and shows it as a tooltip on focus", async () => {
    const { user } = renderUI(
      <IconButton icon={Plus} aria-label="Add source" shortcut={["mod", "U"]} />,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Add source" })).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Add source");
  });

  it("has no axe violations", async () => {
    const { container } = renderUI(<IconButton icon={Plus} aria-label="Add source" />);
    await expectNoAxeViolations(container);
  });
});

describe("SplitButton", () => {
  const setup = () => {
    const fromUpload = vi.fn();
    const utils = renderUI(
      <SplitButton
        label="New notebook"
        onClick={() => {}}
        options={[
          { label: "From upload", onSelect: fromUpload },
          { label: "From library", onSelect: () => {} },
        ]}
      />,
    );
    return { ...utils, fromUpload };
  };

  it("Tab reaches both parts", async () => {
    const { user } = setup();
    await user.tab();
    expect(screen.getByRole("button", { name: "New notebook" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "More options for New notebook" })).toHaveFocus();
  });

  it("Enter on the chevron opens the menu; Esc closes it and returns focus", async () => {
    const { user, fromUpload } = setup();
    const chevron = screen.getByRole("button", { name: "More options for New notebook" });
    chevron.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "From upload" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(chevron).toHaveFocus();

    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("menuitem", { name: "From upload" }));
    expect(fromUpload).toHaveBeenCalledOnce();
  });

  it("has no axe violations", async () => {
    const { container } = setup();
    await expectNoAxeViolations(container);
  });
});

describe("CopyButton", () => {
  afterEach(() => vi.useRealTimers());

  it("copies, shows Copied, and reverts after 1.5s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = renderUI(<CopyButton value="(batch, seq, d_model)" showLabel />, {
      fakeTimers: true,
    });
    const writeText = vi.spyOn(navigator.clipboard, "writeText");

    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("(batch, seq, d_model)");
    expect(screen.getByText("Copied", { selector: "[aria-live]" })).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(1600));
    expect(screen.queryByText("Copied", { selector: "[aria-live]" })).not.toBeInTheDocument();
  });

  it("shows how to copy by hand when the clipboard fails", async () => {
    const { user } = renderUI(<CopyButton value="x" />);
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(screen.getByText(COPY_ERROR, { selector: "[aria-live]" })).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = renderUI(<CopyButton value="x" />);
    await expectNoAxeViolations(container);
  });
});

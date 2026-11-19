import { act, render, screen } from "@testing-library/react";
import { Plus } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Avatar, AvatarStack, initials } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { LevelFlag } from "@/components/ui/level-flag";
import { ProgressBar, ProgressDots, ProgressRing } from "@/components/ui/progress";
import { DelayedSkeleton, SkeletonSourceCard } from "@/components/ui/skeleton";
import { STATUS, StatusPill, type DocumentStatus } from "@/components/ui/status-pill";
import { SelectableTag, Tag } from "@/components/ui/tag";
import { expectNoAxeViolations } from "@/test/axe";
import { renderUI } from "@/test/render";

afterEach(() => vi.useRealTimers());

describe("StatusPill", () => {
  it.each(Object.keys(STATUS) as DocumentStatus[])("always shows a word for %s", (status) => {
    renderUI(<StatusPill status={status} detail="12 pages" />);
    expect(screen.getByText(STATUS[status].word)).toBeInTheDocument();
    expect(screen.getByText("· 12 pages")).toBeInTheDocument();
  });

  it("plays the Ready emphasis when a document becomes ready", () => {
    // Plain render: rerender must keep the same tree so the pill updates instead of remounting.
    const { container, rerender } = render(<StatusPill status="indexing" />);
    expect(container.querySelector('[class*="ready-emphasis"]')).toBeNull();
    rerender(<StatusPill status="ready" />);
    expect(container.querySelector('[class*="ready-emphasis"]')).not.toBeNull();
  });
});

describe("Avatar", () => {
  it("falls back to initials", () => {
    expect(initials("Asha Rao")).toBe("AR");
    expect(initials("Mei")).toBe("ME");
    renderUI(<Avatar name="Asha Rao" />);
    expect(screen.getByRole("img", { name: "Asha Rao" })).toHaveTextContent("AR");
  });

  it("stack shows +N and is labelled with the total", () => {
    const people = ["Asha Rao", "Vikram Singh", "Mei Lin", "Jonas Berg", "Sara Okafor"].map(
      (name) => ({ name }),
    );
    renderUI(<AvatarStack people={people} max={3} />);
    const stack = screen.getByRole("img", { name: "Shared with 5 people" });
    expect(stack).toHaveTextContent("+2");
  });
});

describe("Tooltip", () => {
  it("opens on focus and closes on Esc", async () => {
    const { user } = renderUI(<IconButton icon={Plus} aria-label="New notebook" />);
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("New notebook");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens on hover after the 400ms delay", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = renderUI(<IconButton icon={Plus} aria-label="New notebook" />, {
      fakeTimers: true,
    });
    await user.hover(screen.getByRole("button", { name: "New notebook" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(450));
    expect(screen.getByRole("tooltip")).toHaveTextContent("New notebook");
  });
});

describe("Progress", () => {
  it("bar exposes its value", () => {
    renderUI(<ProgressBar value={40} label="Uploading" />);
    const bar = screen.getByRole("progressbar", { name: "Uploading" });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("indeterminate bar has no value; dots and ring are labelled", () => {
    renderUI(
      <>
        <ProgressBar label="Reading" />
        <ProgressDots steps={5} current={2} />
        <ProgressRing value={60} label="Course" />
      </>,
    );
    expect(screen.getByRole("progressbar", { name: "Reading" })).not.toHaveAttribute(
      "aria-valuenow",
    );
    expect(screen.getByRole("img", { name: "Step 2 of 5" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Course" })).toHaveAttribute(
      "aria-valuenow",
      "60",
    );
  });
});

describe("DelayedSkeleton", () => {
  it("stays hidden for the first 300ms", async () => {
    vi.useFakeTimers();
    const { container } = renderUI(
      <DelayedSkeleton>
        <SkeletonSourceCard />
      </DelayedSkeleton>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(2));
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });
});

describe("EmptyState", () => {
  it("has exactly one primary action", () => {
    const { container } = renderUI(
      <EmptyState
        title="Add your first source"
        description="Add a paper, notes or a dataset, then ask anything about it."
        action={{ label: "Add source" }}
        examples={["How does attention work?", "Summarise section 3"]}
      />,
    );
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Add source" })).toHaveAttribute(
      "data-variant",
      "primary",
    );
  });
});

describe("Tag, Kbd, LevelFlag", () => {
  it("remove and select tags", async () => {
    const onRemove = vi.fn();
    const onSelectedChange = vi.fn();
    const { user } = renderUI(
      <>
        <Tag onRemove={onRemove}>Attention</Tag>
        <SelectableTag selected={false} onSelectedChange={onSelectedChange}>
          Training
        </SelectableTag>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Remove Attention" }));
    expect(onRemove).toHaveBeenCalledOnce();
    const chip = screen.getByRole("button", { name: "Training" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await user.click(chip);
    expect(onSelectedChange).toHaveBeenCalledWith(true);
  });

  it("Kbd shows Ctrl on Windows/Linux; LevelFlag always has its word", () => {
    renderUI(
      <>
        <Kbd keys={["mod", "K"]} />
        <LevelFlag level="expert" />
      </>,
    );
    expect(screen.getByText("Ctrl K")).toBeInTheDocument();
    expect(screen.getByText("Expert")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = renderUI(
      <div>
        <Badge variant="cobalt">Pro</Badge>
        <StatusPill status="ready" detail="15 pages" />
        <Tag onRemove={() => {}}>Attention</Tag>
        <LevelFlag level="beginner" />
        <AvatarStack people={[{ name: "Asha Rao" }, { name: "Mei Lin" }]} />
        <Kbd keys={["mod", "K"]} />
        <ProgressBar value={40} label="Uploading" />
        <ProgressDots steps={3} current={1} />
        <ProgressRing value={30} label="Quiz" />
        <EmptyState
          title="No sources match"
          description="Try another word."
          action={{ label: "Clear filters" }}
        />
      </div>,
    );
    await expectNoAxeViolations(container);
  });
});

import { screen, waitFor } from "@testing-library/react";
import { BookOpen, GraduationCap, Sprout } from "lucide-react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox, CheckboxField } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch, SwitchField } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { expectNoAxeViolations } from "@/test/axe";
import { renderUI } from "@/test/render";

const TOPICS = [
  { value: "attention", label: "Attention" },
  { value: "residual", label: "Residual connections" },
  { value: "layernorm", label: "Layer normalisation" },
];

describe("Field", () => {
  it("wires label, helper, error and aria-invalid to the control", () => {
    const { rerender } = renderUI(
      <Field label="Link" helper="A PDF or a web page.">
        <Input prefix="https://" />
      </Field>,
    );
    const input = screen.getByLabelText("Link");
    expect(input).toHaveAccessibleDescription("A PDF or a web page.");
    expect(input).not.toHaveAttribute("aria-invalid");

    const error = "This link isn't a PDF or web page. Paste a link that starts with https://.";
    rerender(
      <Field label="Link" helper="A PDF or a web page." error={error}>
        <Input prefix="https://" />
      </Field>,
    );
    expect(screen.getByLabelText("Link")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Link")).toHaveAccessibleDescription(error);
  });

  it("Input shows a Clear button while it has a value", async () => {
    const onClear = vi.fn();
    const { user } = renderUI(
      <Input aria-label="Link" value="arxiv.org" onChange={() => {}} onClear={onClear} />,
    );
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});

describe("SearchInput", () => {
  it("Esc clears the text, then blurs", async () => {
    const { user } = renderUI(<SearchInput aria-label="Search sources" />);
    const box = screen.getByRole("searchbox", { name: "Search sources" });
    await user.click(box);
    await user.keyboard("bert");
    expect(box).toHaveValue("bert");
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(box).toHaveValue("");
    expect(box).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(box).not.toHaveFocus();
  });
});

describe("Textarea", () => {
  it("grows with content and caps at 8 lines, then scrolls", async () => {
    const { user } = renderUI(<Textarea aria-label="Question" />);
    const textarea = screen.getByRole("textbox", { name: "Question" }) as HTMLTextAreaElement;
    let contentHeight = 24 * 3;
    Object.defineProperty(textarea, "scrollHeight", { get: () => contentHeight });

    await user.type(textarea, "a");
    expect(textarea.style.height).toBe("72px");
    expect(textarea.style.overflowY).toBe("hidden");

    contentHeight = 24 * 20;
    await user.type(textarea, "b");
    expect(textarea.style.height).toBe(`${24 * 8}px`);
    expect(textarea.style.overflowY).toBe("auto");
  });

  it("counter turns warning at 90% and danger over the limit", async () => {
    const { user } = renderUI(<Textarea aria-label="Note" limit={10} />);
    const textarea = screen.getByRole("textbox", { name: "Note" });
    await user.type(textarea, "123456789");
    expect(screen.getByText("9 / 10")).toHaveClass("text-warning-strong");
    await user.type(textarea, "01");
    expect(screen.getByText("11 / 10")).toHaveClass("text-danger-strong");
  });
});

describe("Select", () => {
  it("opens with the keyboard and selects with arrows and Enter", async () => {
    const onValueChange = vi.fn();
    const { user } = renderUI(
      <Field label="Notebook">
        <Select onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a notebook" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="transformers">Transformers</SelectItem>
            <SelectItem value="vision">Vision</SelectItem>
          </SelectContent>
        </Select>
      </Field>,
    );
    const trigger = screen.getByRole("combobox", { name: "Notebook" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("vision");
    expect(trigger).toHaveTextContent("Vision");
  });
});

describe("Combobox", () => {
  it("filters, selects with the keyboard and shows an empty state", async () => {
    const onValueChange = vi.fn();
    const { user } = renderUI(
      <Combobox aria-label="Topic" options={TOPICS} onValueChange={onValueChange} />,
    );
    const trigger = screen.getByRole("button", { name: "Topic" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("zzz");
    expect(await screen.findByText("No matches for “zzz”")).toBeInTheDocument();

    await user.keyboard("{Backspace>3/}resid");
    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("residual");
    expect(trigger).toHaveTextContent("Residual connections");
    expect(trigger).toHaveFocus();
  });

  it("multi-select shows removable tags", async () => {
    const { user } = renderUI(
      <Combobox aria-label="Topics" multiple options={TOPICS} defaultValue={["attention"]} />,
    );
    await user.click(screen.getByRole("button", { name: "Remove Attention" }));
    expect(screen.queryByRole("button", { name: "Remove Attention" })).not.toBeInTheDocument();
  });
});

describe("Checkbox", () => {
  function Cycle() {
    const [checked, setChecked] = useState<boolean | "indeterminate">("indeterminate");
    return <CheckboxField label="All sources" checked={checked} onCheckedChange={setChecked} />;
  }

  it("goes from indeterminate to checked to unchecked", async () => {
    const { user } = renderUI(<Cycle />);
    const box = screen.getByRole("checkbox", { name: "All sources" });
    expect(box).toHaveAttribute("aria-checked", "mixed");
    await user.click(box);
    expect(box).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByText("All sources"));
    expect(box).toHaveAttribute("aria-checked", "false");
  });
});

describe("RadioCard", () => {
  it("arrow keys move the selection", async () => {
    const { user } = renderUI(
      <RadioCardGroup aria-label="Level" defaultValue="beginner">
        <RadioCard value="beginner" icon={Sprout} title="Beginner" />
        <RadioCard value="intermediate" icon={BookOpen} title="Intermediate" />
        <RadioCard value="expert" icon={GraduationCap} title="Expert" />
      </RadioCardGroup>,
    );
    await user.tab();
    expect(screen.getByRole("radio", { name: "Beginner" })).toHaveFocus();
    // Hold the key like a person does: Radix moves focus in a timeout and checks the radio only
    // while the arrow key is still down.
    await user.keyboard("{ArrowRight>}");
    await waitFor(() => expect(screen.getByRole("radio", { name: "Intermediate" })).toBeChecked());
    await user.keyboard("{/ArrowRight}");
  });
});

describe("Switch", () => {
  it("toggles with Space and shows its state", async () => {
    const { user } = renderUI(<SwitchField label="Show diagrams automatically" showState />);
    const toggle = screen.getByRole("switch", { name: "Show diagrams automatically" });
    toggle.focus();
    await user.keyboard(" ");
    expect(toggle).toBeChecked();
    expect(screen.getByText("On")).toBeInTheDocument();
  });
});

describe("SegmentedControl", () => {
  it("keeps exactly one choice and works with arrow keys", async () => {
    const onValueChange = vi.fn();
    const { user } = renderUI(
      <SegmentedControl
        aria-label="Theme"
        defaultValue="light"
        onValueChange={onValueChange}
        options={[
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
          { value: "system", label: "System" },
        ]}
      />,
    );
    const light = screen.getByRole("radio", { name: "Light" });
    await user.click(light);
    expect(light).toBeChecked(); // clicking the selected segment doesn't clear it
    light.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveFocus();
    await user.keyboard(" ");
    expect(onValueChange).toHaveBeenLastCalledWith("dark");
    expect(
      screen.getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true"),
    ).toHaveLength(1);
  });
});

describe("axe", () => {
  it("finds no violations across the input family", async () => {
    const { container } = renderUI(
      <form aria-label="Add a source by link">
        <Field
          label="Link"
          error="This link isn't a PDF or web page. Paste a link that starts with https://."
        >
          <Input prefix="https://" />
        </Field>
        <SearchInput aria-label="Search sources" />
        <Field label="Notes">
          <Textarea limit={200} />
        </Field>
        <Field label="Notebook">
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Choose a notebook" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Transformers</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Combobox aria-label="Topics" multiple options={TOPICS} defaultValue={["attention"]} />
        <Checkbox aria-label="Include figures" />
        <CheckboxField label="Include figures" description="Read charts and diagrams too." />
        <Switch aria-label="Auto-save" />
        <SwitchField label="Show citations inline" description="Numbered chips after each claim." />
        <RadioCardGroup aria-label="Level" defaultValue="b">
          <RadioCard value="b" title="Beginner" description="Plain words first." />
          <RadioCard value="e" title="Expert" />
        </RadioCardGroup>
        <SegmentedControl
          aria-label="Theme"
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </form>,
    );
    await expectNoAxeViolations(container);
  });
});

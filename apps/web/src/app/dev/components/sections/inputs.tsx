"use client";

import { BookOpen, GraduationCap, Laptop, Moon, Sprout, Sun } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch, SwitchField } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Demo, ShowcaseSection, StateMatrix } from "../showcase";

const FIELD_STATES = ["Default", "Hover", "Focus", "Filled", "Error", "Disabled"];
type FieldState = "default" | "hover" | "focus" | "filled" | "error" | "disabled";
const STATE_KEYS: FieldState[] = ["default", "hover", "focus", "filled", "error", "disabled"];

const TOPICS = [
  { value: "attention", label: "Attention" },
  { value: "residual", label: "Residual connections" },
  { value: "layernorm", label: "Layer normalisation" },
  { value: "positional", label: "Positional encoding" },
  { value: "tokenization", label: "Tokenisation" },
];

function stateProps(state: FieldState) {
  return {
    "data-force": state === "hover" || state === "focus" ? state : undefined,
    "aria-invalid": state === "error" ? true : undefined,
    disabled: state === "disabled",
  };
}

const LINK_ERROR = "This link isn't a PDF or web page. Paste a link that starts with https://.";

function AddSourceForm() {
  const [link, setLink] = useState("");
  const [error, setError] = useState<string>();
  return (
    <form
      noValidate
      aria-label="Add a source by link"
      className="flex max-w-md flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const bare = link.replace(/^https?:\/\//, "");
        setError(/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(bare) ? undefined : LINK_ERROR);
      }}
    >
      <Field label="Link" helper="A PDF or a web page." error={error} required>
        <Input
          prefix="https://"
          placeholder="arxiv.org/abs/1706.03762"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onClear={() => setLink("")}
        />
      </Field>
      <div>
        <Button type="submit">Add source</Button>
      </div>
    </form>
  );
}

export function InputsSection() {
  const [level, setLevel] = useState("intermediate");
  return (
    <ShowcaseSection
      id="inputs"
      title="Inputs"
      usage="Every control sits in a <Field> so its label, helper and error are wired up. Errors say what happened and how to fix it. Use lg (44px) on touch layouts."
    >
      <Demo title="Text fields">
        <StateMatrix
          columns={FIELD_STATES}
          rows={[
            {
              label: "Input",
              cells: STATE_KEYS.map((s) => (
                <Input
                  key={s}
                  aria-label="Title"
                  className="w-36"
                  placeholder="Notebook title"
                  defaultValue={s === "filled" || s === "error" ? "Attention notes" : undefined}
                  {...stateProps(s)}
                />
              )),
            },
            {
              label: "With prefix",
              cells: STATE_KEYS.map((s) => (
                <Input
                  key={s}
                  aria-label="Link"
                  className="w-36"
                  prefix="https://"
                  placeholder="arxiv.org"
                  defaultValue={s === "filled" || s === "error" ? "arxiv.org" : undefined}
                  {...stateProps(s)}
                />
              )),
            },
            {
              label: "Search",
              cells: STATE_KEYS.map((s) => (
                <SearchInput
                  key={s}
                  aria-label="Search"
                  className="w-36"
                  placeholder="Search"
                  defaultValue={s === "filled" || s === "error" ? "bert" : undefined}
                  {...stateProps(s)}
                />
              )),
            },
            {
              label: "Textarea",
              cells: STATE_KEYS.map((s) => (
                <Textarea
                  key={s}
                  aria-label="Question"
                  className="w-36"
                  placeholder="Ask anything"
                  defaultValue={
                    s === "filled" || s === "error" ? "How does attention scale?" : undefined
                  }
                  {...stateProps(s)}
                />
              )),
            },
            {
              label: "Select",
              cells: STATE_KEYS.map((s) => (
                <Select
                  key={s}
                  disabled={s === "disabled"}
                  defaultValue={s === "filled" || s === "error" ? "transformers" : undefined}
                >
                  <SelectTrigger
                    aria-label="Notebook"
                    className="w-36"
                    data-force={s === "hover" || s === "focus" ? s : undefined}
                    aria-invalid={s === "error" || undefined}
                  >
                    <SelectValue placeholder="Notebook" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transformers">Transformers</SelectItem>
                  </SelectContent>
                </Select>
              )),
            },
            {
              label: "Combobox",
              cells: STATE_KEYS.map((s) => (
                <Combobox
                  key={s}
                  aria-label="Topic"
                  className="w-36"
                  placeholder="Topic"
                  options={TOPICS}
                  defaultValue={s === "filled" || s === "error" ? "attention" : undefined}
                  {...stateProps(s)}
                />
              )),
            },
          ]}
        />
      </Demo>

      <Demo title="Choices">
        <StateMatrix
          columns={["Off", "On", "Mixed", "Hover", "Focus", "Disabled"]}
          rows={[
            {
              label: "Checkbox",
              cells: [
                <Checkbox key="off" aria-label="Off" />,
                <Checkbox key="on" aria-label="On" checked />,
                <Checkbox key="mixed" aria-label="Mixed" checked="indeterminate" />,
                <Checkbox key="hover" aria-label="Hover" data-force="hover" />,
                <Checkbox key="focus" aria-label="Focus" data-force="focus" />,
                <Checkbox key="disabled" aria-label="Disabled" disabled checked />,
              ],
            },
            {
              label: "Switch",
              cells: [
                <Switch key="off" aria-label="Off" />,
                <Switch key="on" aria-label="On" checked />,
                <span key="mixed" className="text-small text-graphite">
                  —
                </span>,
                <Switch key="hover" aria-label="Hover" data-force="hover" />,
                <Switch key="focus" aria-label="Focus" data-force="focus" checked />,
                <Switch key="disabled" aria-label="Disabled" disabled checked />,
              ],
            },
          ]}
        />
      </Demo>

      <Demo title="Radio cards" note="Default · hover · focus · selected · disabled">
        <div inert className="flex flex-wrap gap-3">
          {(["default", "hover", "focus", "selected", "disabled"] as const).map((s) => (
            <RadioCardGroup
              key={s}
              aria-label={s}
              value={s === "selected" ? "x" : ""}
              disabled={s === "disabled"}
              className="w-44 grid-cols-1 sm:grid-cols-1"
            >
              <RadioCard
                value="x"
                icon={BookOpen}
                title="Intermediate"
                description="Some background assumed."
                data-force={s === "hover" || s === "focus" ? s : undefined}
              />
            </RadioCardGroup>
          ))}
        </div>
      </Demo>

      <Demo title="Live example" className="flex flex-col gap-8">
        <AddSourceForm />
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <Field label="Add to notebook">
            <Select defaultValue="transformers">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Recent</SelectLabel>
                  <SelectItem value="transformers">Transformers</SelectItem>
                  <SelectItem value="vision">Vision models</SelectItem>
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>All notebooks</SelectLabel>
                  <SelectItem value="rl">Reinforcement learning</SelectItem>
                  <SelectItem value="stats">Statistics 101</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Topics">
            <Combobox
              multiple
              options={TOPICS}
              defaultValue={["attention"]}
              placeholder="Add topics"
            />
          </Field>
          <SearchInput aria-label="Search sources" className="sm:col-span-2" />
          <Field label="Your notes" helper="Shown next to the answer." className="sm:col-span-2">
            <Textarea limit={200} placeholder="What do you want to remember?" />
          </Field>
        </div>
        <div className="flex max-w-xl flex-col gap-3">
          <CheckboxField
            label="Include figures"
            description="Read charts and diagrams in the paper too."
            defaultChecked
          />
          <SwitchField
            label="Show citations inline"
            description="Numbered chips after each claim."
            badge={<Badge variant="primary">Recommended</Badge>}
            defaultChecked
            showState
          />
        </div>
        <RadioCardGroup
          aria-label="Explanation level"
          value={level}
          onValueChange={setLevel}
          className="max-w-2xl"
        >
          <RadioCard
            value="beginner"
            icon={Sprout}
            title="Beginner"
            description="Plain words, no maths first."
          />
          <RadioCard
            value="intermediate"
            icon={BookOpen}
            title="Intermediate"
            description="Some background assumed."
          />
          <RadioCard
            value="expert"
            icon={GraduationCap}
            title="Expert"
            description="Dense, with the full maths."
          />
        </RadioCardGroup>
        <div className="flex flex-wrap gap-4">
          <SegmentedControl
            aria-label="Theme"
            defaultValue="system"
            options={[
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
              { value: "system", label: "System", icon: Laptop },
            ]}
          />
          <SegmentedControl
            aria-label="Level"
            value={level}
            onValueChange={setLevel}
            options={[
              { value: "beginner", label: "Beginner" },
              { value: "intermediate", label: "Intermediate" },
              { value: "expert", label: "Expert" },
            ]}
          />
        </div>
      </Demo>
    </ShowcaseSection>
  );
}

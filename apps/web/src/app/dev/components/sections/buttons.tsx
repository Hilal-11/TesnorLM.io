"use client";

import { Copy, Download, FolderOpen, MoreHorizontal, Plus, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { IconButton } from "@/components/ui/icon-button";
import { SplitButton } from "@/components/ui/split-button";
import { Demo, forceState, ShowcaseSection, StateMatrix, type DemoState } from "../showcase";

const STATES: DemoState[] = ["default", "hover", "pressed", "focus", "disabled", "loading"];
const COLUMNS = ["Default", "Hover", "Pressed", "Focus", "Disabled", "Loading"];

const VARIANTS = [
  { variant: "primary", label: "Add source" },
  { variant: "secondary", label: "Add source" },
  { variant: "ghost", label: "Add source" },
  { variant: "danger", label: "Delete source" },
  { variant: "link", label: "View source" },
] as const;

const SNIPPET = "scores = q @ k.T / math.sqrt(d_k)";

export function ButtonsSection() {
  return (
    <ShowcaseSection
      id="buttons"
      title="Buttons"
      usage="Primary (black) for the one main action in a view. Secondary and ghost for everything else, danger only for destructive actions, link inside text. Labels are a verb and an object."
    >
      <Demo title="Button" note="Size md. Loading keeps the label and width.">
        <StateMatrix
          columns={COLUMNS}
          rows={VARIANTS.map(({ variant, label }) => ({
            label: variant,
            cells: STATES.map((state) => (
              <Button key={state} variant={variant} {...forceState(state)}>
                {label}
              </Button>
            )),
          }))}
        />
      </Demo>

      <Demo title="Sizes" note="sm 32px · md 36px · lg 44px (touch). Icons 16px, 18px at lg.">
        <StateMatrix
          columns={COLUMNS}
          rows={(["sm", "md", "lg"] as const).map((size) => ({
            label: size,
            cells: STATES.map((state) => (
              <Button key={state} size={size} leadingIcon={Plus} {...forceState(state)}>
                Add source
              </Button>
            )),
          }))}
        />
      </Demo>

      <Demo title="Icon button" note="Square, press scales to 0.94, label shown as a tooltip.">
        <StateMatrix
          columns={COLUMNS}
          rows={(["ghost", "secondary", "primary"] as const).map((variant) => ({
            label: variant,
            cells: STATES.map((state) => (
              <IconButton
                key={state}
                variant={variant}
                icon={Upload}
                aria-label="Add source"
                tooltip={false}
                {...forceState(state)}
              />
            )),
          }))}
        />
      </Demo>

      <Demo title="Live example" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <IconButton icon={Upload} aria-label="Add source" shortcut={["mod", "U"]} />
          <IconButton icon={Search} aria-label="Search sources" shortcut={["mod", "K"]} />
          <IconButton icon={Download} aria-label="Download notes" variant="secondary" />
          <IconButton icon={MoreHorizontal} aria-label="More actions" />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <SplitButton
            label="New notebook"
            leadingIcon={Plus}
            onClick={() => {}}
            options={[
              { label: "From upload", icon: Upload, onSelect: () => {} },
              { label: "From library", icon: FolderOpen, onSelect: () => {} },
            ]}
          />
          <SplitButton
            label="Export"
            variant="secondary"
            onClick={() => {}}
            options={[
              { label: "As PDF", onSelect: () => {} },
              { label: "As Markdown", onSelect: () => {} },
            ]}
          />
          <Button asChild variant="link">
            <a href="#buttons">Read the guide</a>
          </Button>
        </div>
        <figure className="flex max-w-xl flex-col overflow-hidden rounded-md border border-rule bg-sheet">
          <figcaption className="flex items-center justify-between border-b border-rule py-1 pr-1 pl-4 text-small text-graphite">
            python
            <CopyButton value={SNIPPET} label="Copy code" showLabel />
          </figcaption>
          <pre className="overflow-x-auto p-4 text-code">
            <code>{SNIPPET}</code>
          </pre>
        </figure>
        <p className="flex items-center gap-2 text-small text-graphite">
          <Copy aria-hidden className="size-4" /> Copy shows a check and &ldquo;Copied&rdquo; for
          1.5s, announced to screen readers.
        </p>
      </Demo>
    </ShowcaseSection>
  );
}

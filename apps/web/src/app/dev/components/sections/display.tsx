"use client";

import { Copy, FileText, Plus, Upload } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { LevelFlag } from "@/components/ui/level-flag";
import { ProgressBar, ProgressDots, ProgressRing } from "@/components/ui/progress";
import {
  DelayedSkeleton,
  SkeletonMessage,
  SkeletonSourceCard,
  SkeletonTableRow,
} from "@/components/ui/skeleton";
import { StatusPill, type DocumentStatus } from "@/components/ui/status-pill";
import { SelectableTag, Tag } from "@/components/ui/tag";
import { tooltipSurface } from "@/components/ui/tooltip";
import { Demo, ShowcaseSection } from "../showcase";

const PIPELINE: { status: DocumentStatus; detail?: string }[] = [
  { status: "queued" },
  { status: "uploading", detail: "48%" },
  { status: "reading", detail: "page 6 of 15" },
  { status: "indexing" },
  { status: "ready", detail: "15 pages" },
  { status: "failed", detail: "Scanned PDF with no text layer" },
];

const PEOPLE = [
  "Asha Rao",
  "Vikram Singh",
  "Mei Lin",
  "Jonas Berg",
  "Sara Okafor",
  "Tomás Ruiz",
  "Lena Weiss",
].map((name) => ({ name }));

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

function SourceCard() {
  return (
    <div className="flex items-center gap-3 rounded-md border border-rule bg-sheet p-3">
      <span className="flex size-8 items-center justify-center rounded-sm bg-danger/12 text-danger-strong">
        <FileText aria-hidden className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body font-medium">attention-is-all-you-need.pdf</span>
        <StatusPill status="ready" detail="15 pages" className="-ml-1 self-start" />
      </div>
    </div>
  );
}

export function DisplaySection() {
  const [selected, setSelected] = useState(["Attention"]);
  const [loadKey, setLoadKey] = useState(0);
  const toggle = (t: string) =>
    setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  return (
    <ShowcaseSection
      id="display"
      title="Display"
      usage="Status is always an icon, a word and a colour. Badges label; tags filter. Skeletons match the shape they stand in for and appear only after 300ms."
    >
      <Demo title="Badge">
        <Row>
          <Badge>New</Badge>
          <Badge variant="cobalt">Pro</Badge>
          <Badge variant="cobalt">Recommended</Badge>
          <Badge variant="success">Indexed</Badge>
          <Badge variant="warning">Beta</Badge>
          <Badge variant="danger">Over limit</Badge>
        </Row>
      </Demo>

      <Demo
        title="Status pill"
        note="The document pipeline, left to right. Ready plays a 1.5s success wash once."
      >
        <Row>
          {PIPELINE.map(({ status, detail }) => (
            <StatusPill key={status} status={status} detail={detail} celebrate />
          ))}
        </Row>
      </Demo>

      <Demo title="Tag and level">
        <div className="flex flex-col gap-3">
          <Row>
            <Tag>Transformers</Tag>
            <Tag onRemove={() => {}}>Attention</Tag>
            <Tag onRemove={() => {}}>Section 3</Tag>
          </Row>
          <Row>
            {["Attention", "Embeddings", "Training"].map((t) => (
              <SelectableTag
                key={t}
                selected={selected.includes(t)}
                onSelectedChange={() => toggle(t)}
              >
                {t}
              </SelectableTag>
            ))}
          </Row>
          <Row>
            <LevelFlag level="beginner" />
            <LevelFlag level="intermediate" />
            <LevelFlag level="expert" />
          </Row>
        </div>
      </Demo>

      <Demo title="Avatar and keys">
        <div className="flex flex-col gap-3">
          <Row>
            <Avatar name="Asha Rao" size={24} />
            <Avatar name="Asha Rao" size={32} />
            <Avatar name="Asha Rao" size={40} />
            <AvatarStack people={PEOPLE} />
          </Row>
          <Row>
            <Kbd keys={["mod", "K"]} />
            <Kbd keys={["mod", "U"]} />
            <Kbd keys={["mod", "shift", "C"]} />
            <Kbd>Esc</Kbd>
          </Row>
        </div>
      </Demo>

      <Demo
        title="Tooltip"
        note="Hover or focus the buttons. Tooltips repeat information; they never hold it alone."
      >
        <Row>
          <div inert className={tooltipSurface}>
            Copy answer <Kbd keys={["mod", "shift", "C"]} />
          </div>
          <IconButton icon={Copy} aria-label="Copy answer" shortcut={["mod", "shift", "C"]} />
          <IconButton icon={Upload} aria-label="Add source" shortcut={["mod", "U"]} />
          <IconButton icon={Plus} aria-label="New notebook" />
        </Row>
      </Demo>

      <Demo title="Progress">
        <div className="flex max-w-md flex-col gap-4">
          <ProgressBar value={40} label="Uploading attention-is-all-you-need.pdf" />
          <ProgressBar value={72} size={6} label="Indexing" />
          <ProgressBar label="Reading your sources" />
          <Row>
            <ProgressDots steps={5} current={2} />
            <ProgressRing value={25} size={32} label="Quiz progress" />
            <ProgressRing value={60} size={48} label="Course progress" />
            <ProgressRing value={100} size={64} label="Notebook indexed" />
          </Row>
        </div>
      </Demo>

      <Demo title="Skeleton" note="Each skeleton beside the component it stands in for.">
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonSourceCard />
          <SourceCard />
          <SkeletonMessage />
          <p className="measure text-body-read">
            Attention lets each word look at every other word and decide which ones matter for its
            meaning.
          </p>
          <div className="rounded-md border border-rule bg-sheet sm:col-span-2">
            <SkeletonTableRow columns={4} />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button variant="secondary" size="sm" onClick={() => setLoadKey((k) => k + 1)}>
              Reload
            </Button>
            <span className="text-small text-graphite">Nothing shows for the first 300ms.</span>
          </div>
          <div className="sm:col-span-2">
            <DelayedSkeleton key={loadKey} label="Loading sources">
              <SkeletonSourceCard />
            </DelayedSkeleton>
          </div>
        </div>
      </Demo>

      <Demo title="Empty state">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-rule bg-sheet">
            <EmptyState
              icon={FileText}
              title="No sources match"
              description="Try another word, or clear the filters to see every source."
              action={{ label: "Clear filters" }}
            />
          </div>
          <div className="rounded-md border border-rule">
            <EmptyState
              graphPaper
              icon={Upload}
              title="Add your first source"
              description="Add a paper, notes or a dataset, then ask anything about it."
              action={{ label: "Add source", icon: Plus }}
              examples={["How does attention work?", "Summarise section 3", "Explain Figure 2"]}
            />
          </div>
        </div>
      </Demo>
    </ShowcaseSection>
  );
}

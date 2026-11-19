"use client";

import {
  ArrowUp,
  BookOpen,
  Clock,
  FilePlus2,
  NotebookPen,
  Paperclip,
  Sparkle,
  type LucideIcon,
} from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { LevelSwitch } from "./level-switch";

const noop = () => () => {};

/** "Good morning" in the person's own time zone; a neutral greeting during server render. */
function useGreeting() {
  return useSyncExternalStore(
    noop,
    () => {
      const hour = new Date().getHours();
      return hour < 5
        ? "Good evening"
        : hour < 12
          ? "Good morning"
          : hour < 18
            ? "Good afternoon"
            : "Good evening";
    },
    () => "Welcome back",
  );
}

const SOON = "Uploading sources arrives in the next update.";

const GET_STARTED: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: FilePlus2, title: "Upload a paper", body: "PDFs, notes, images or CSVs." },
  {
    icon: BookOpen,
    title: "Try the sample paper",
    body: "Attention Is All You Need, explained step by step.",
  },
  { icon: NotebookPen, title: "Create a notebook", body: "Group the sources for one topic." },
];

export function HomeDashboard({
  firstName,
  level,
}: {
  firstName: string | null;
  level: "beginner" | "intermediate" | "expert";
}) {
  const greeting = useGreeting();
  const [question, setQuestion] = useState("");

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-h1 text-ink">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-body text-graphite">What are we learning today?</p>
      </header>

      <form
        aria-label="Ask about a paper"
        onSubmit={(e) => {
          e.preventDefault();
          toast.info("Add a source first, then ask anything about it.", { description: SOON });
        }}
        className="flex flex-col gap-3 rounded-lg border border-rule bg-sheet p-3 shadow-2 within-focus:border-ink/40"
      >
        <label htmlFor="home-question" className="sr-only">
          Your question
        </label>
        <textarea
          id="home-question"
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about a research paper, or upload a PDF…"
          className="w-full resize-none bg-transparent px-1 text-body-read text-ink outline-none placeholder:text-graphite"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip label={SOON}>
            <Button variant="secondary" size="sm" leadingIcon={Paperclip} aria-disabled>
              Attach
            </Button>
          </Tooltip>
          <LevelSwitch level={level} />
          <span className="ml-auto text-caption text-graphite max-sm:hidden">
            Answers cite the page they came from
          </span>
          <IconButton
            type="submit"
            icon={ArrowUp}
            aria-label="Ask"
            variant="primary"
            size="sm"
            tooltip={false}
            disabled={!question.trim()}
          />
        </div>
      </form>

      <section aria-labelledby="get-started" className="flex flex-col gap-3">
        <h2 id="get-started" className="text-h3 text-ink">
          Get started
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {GET_STARTED.map(({ icon: Icon, title, body }) => (
            <button
              key={title}
              type="button"
              onClick={() => toast.info(title, { description: SOON })}
              className="group flex cursor-pointer flex-col items-start gap-3 rounded-md border border-rule bg-sheet p-4 text-left shadow-1 interactive hover:border-rule-strong hover:shadow-2 active:scale-98"
            >
              <span className="flex size-8 items-center justify-center rounded-sm bg-muted text-ink">
                <Icon aria-hidden className="size-4" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-body font-medium text-ink">{title}</span>
                <span className="text-small text-graphite">{body}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Continue learning" icon={Sparkle}>
          <p className="text-body font-medium text-ink">No notebooks yet</p>
          <p className="text-small text-graphite">
            Notebooks you open show up here with your progress, so you can pick up where you left
            off.
          </p>
        </Panel>
        <Panel title="Recent activity" icon={Clock}>
          <p className="text-body font-medium text-ink">Nothing yet</p>
          <p className="text-small text-graphite">
            Lessons, quizzes and processed sources appear here.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-md border border-rule bg-sheet shadow-1">
      <h2 className="flex items-center gap-2 border-b border-rule bg-subtle px-4 py-2.5 text-small font-medium text-ink">
        <Icon aria-hidden className="size-3.5 text-graphite" />
        {title}
      </h2>
      <div className="flex min-h-36 flex-col items-start justify-center gap-1 p-4">{children}</div>
    </section>
  );
}

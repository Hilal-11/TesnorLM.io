"use client";

import {
  Atom,
  BookOpen,
  Brain,
  Check,
  Code,
  Cpu,
  Dna,
  FileUp,
  GraduationCap,
  Microscope,
  NotebookText,
  Plus,
  Presentation,
  Sigma,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import { cn } from "@/lib/utils";
import { finishOnboarding, saveOnboardingStep } from "./actions";

type Role = "student" | "instructor" | "developer" | "researcher";
type Level = "beginner" | "intermediate" | "expert";
type Source = "sample" | "upload";

export type OnboardingInitial = {
  step: number;
  role: Role | null;
  subjects: string[];
  level: Level;
  firstSource: Source | null;
};

const SUBJECTS: { name: string; icon: LucideIcon }[] = [
  { name: "Machine learning & AI", icon: Brain },
  { name: "Computer science", icon: Code },
  { name: "Mathematics", icon: Sigma },
  { name: "Physics", icon: Atom },
  { name: "Biology", icon: Dna },
  { name: "Electronics", icon: Cpu },
];
const SUBJECT_NAMES = SUBJECTS.map((s) => s.name);
const MAX_SUBJECTS = 8;

const STEPS = [
  {
    title: "What brings you to TensorLM?",
    subtitle: "We'll shape explanations around how you'll use them.",
  },
  { title: "What are you studying?", subtitle: "Pick any that fit. You can change these later." },
  {
    title: "How should explanations feel?",
    subtitle: "The same idea, explained three ways. Pick the one that reads best.",
  },
  { title: "Add your first source", subtitle: "Start with a sample, or bring your own paper." },
];

/** Same idea, three levels (step 3). */
const ATTENTION = {
  beginner:
    "When reading a sentence, the model looks back at the other words and decides which ones help it understand the current word.",
  intermediate:
    "Each word scores every other word for relevance, turns the scores into weights, and mixes the words' information by those weights.",
  expert:
    "softmax(QKᵀ/√dₖ)V: queries and keys give scaled dot-product scores; the softmax weights combine the value vectors.",
};

/** A multi-select card (pressed / not pressed) with an icon tile. */
function ChoiceCard({
  icon: Icon,
  label,
  selected,
  disabled,
  onToggle,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative flex cursor-pointer flex-col items-center gap-3 rounded-md border bg-sheet px-3 py-5 text-center shadow-1 interactive active:scale-98 disabled:cursor-not-allowed disabled:opacity-50",
        selected ? "border-ink ring-1 ring-ink" : "border-rule hover:border-rule-strong",
      )}
    >
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-md",
          selected ? "bg-ink text-paper" : "bg-muted text-ink",
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="text-body font-medium text-ink">{label}</span>
      {selected && (
        <span
          aria-hidden
          className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-ink text-paper"
        >
          <Check strokeWidth={3} className="size-2.5" />
        </span>
      )}
    </button>
  );
}

export function OnboardingWizard({
  firstName,
  initial,
}: {
  firstName: string | null;
  initial: OnboardingInitial;
}) {
  const [step, setStep] = useState(Math.max(1, Math.min(4, initial.step)));
  const [role, setRole] = useState<Role | null>(initial.role);
  const [subjects, setSubjects] = useState<string[]>(initial.subjects);
  const [other, setOther] = useState(
    initial.subjects.find((s) => !SUBJECT_NAMES.includes(s)) ?? "",
  );
  const [otherOn, setOtherOn] = useState(Boolean(other));
  const [level, setLevel] = useState<Level>(initial.level);
  const [source, setSource] = useState<Source | null>(initial.firstSource);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const picked = subjects.filter((s) => SUBJECT_NAMES.includes(s));
  const allSubjects = [...picked, ...(otherOn && other.trim() ? [other.trim()] : [])];
  const full = allSubjects.length >= MAX_SUBJECTS;

  const canContinue =
    (step === 1 && role !== null) || step === 2 || step === 3 || (step === 4 && source !== null);

  function submit() {
    if (!canContinue || pending) return;
    setError(null);
    startTransition(async () => {
      const payload =
        step === 1
          ? { step: 1 as const, role: role! }
          : step === 2
            ? { step: 2 as const, subjects: allSubjects }
            : step === 3
              ? { step: 3 as const, level }
              : { step: 4 as const, first_source: source! };
      const saved = await saveOnboardingStep(null, payload);
      if (saved && !saved.ok) {
        setError(saved.error);
        return;
      }
      if (step < 4) setStep(step + 1);
      else {
        const done = await finishOnboarding(null, {});
        if (done && !done.ok) setError(done.error);
      }
    });
  }

  function skip() {
    startTransition(async () => {
      const done = await finishOnboarding(null, { skip: true });
      if (done && !done.ok) setError(done.error);
    });
  }

  const { title, subtitle } = STEPS[step - 1];

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-rule px-4 md:px-6">
        <LogoMark />
        <div className="mx-auto flex w-full max-w-xs items-center gap-3">
          <span className="shrink-0 text-caption font-medium text-graphite tabular-nums">
            Step {step} of 4
          </span>
          <ProgressBar value={step} max={4} label={`Step ${step} of 4`} />
        </div>
        <Button variant="ghost" size="sm" onClick={skip} disabled={pending}>
          Skip for now
        </Button>
      </header>

      <main className="flex flex-1 flex-col">
        <form
          className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-8 px-4 py-10 md:py-16"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            {step === 1 && firstName && (
              <p className="text-small font-medium text-graphite">Welcome, {firstName}</p>
            )}
            <h1 className="text-h1 text-ink">{title}</h1>
            <p className="max-w-md text-body text-graphite">{subtitle}</p>
          </div>

          {step === 1 && (
            <RadioCardGroup
              aria-label={title}
              value={role ?? ""}
              onValueChange={(v) => setRole(v as Role)}
              className="sm:grid-cols-2"
            >
              <RadioCard
                value="student"
                icon={GraduationCap}
                title="Student"
                description="Courses, exams and papers."
              />
              <RadioCard
                value="instructor"
                icon={Presentation}
                title="Instructor"
                description="Teaching and preparing material."
              />
              <RadioCard
                value="developer"
                icon={Code}
                title="Developer"
                description="Building with models and APIs."
              />
              <RadioCard
                value="researcher"
                icon={Microscope}
                title="Researcher"
                description="Reading and writing papers."
              />
            </RadioCardGroup>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div
                className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                role="group"
                aria-label="Subjects"
              >
                {SUBJECTS.map(({ name, icon }) => {
                  const selected = picked.includes(name);
                  return (
                    <ChoiceCard
                      key={name}
                      icon={icon}
                      label={name}
                      selected={selected}
                      disabled={!selected && full}
                      onToggle={() =>
                        setSubjects((s) => (selected ? s.filter((x) => x !== name) : [...s, name]))
                      }
                    />
                  );
                })}
                <ChoiceCard
                  icon={Plus}
                  label="Other"
                  selected={otherOn}
                  onToggle={() => setOtherOn((v) => !v)}
                />
              </div>
              {otherOn && (
                <Field label="Other subject">
                  <Input
                    value={other}
                    maxLength={60}
                    onChange={(e) => setOther(e.target.value)}
                    autoFocus
                  />
                </Field>
              )}
            </div>
          )}

          {step === 3 && (
            <RadioCardGroup
              aria-label={title}
              value={level}
              onValueChange={(v) => setLevel(v as Level)}
              className="grid-cols-1 sm:grid-cols-1"
            >
              {(
                [
                  ["beginner", "Beginner", Sprout],
                  ["intermediate", "Intermediate", BookOpen],
                  ["expert", "Expert", GraduationCap],
                ] as const
              ).map(([value, label, Icon]) => (
                <RadioCard
                  key={value}
                  value={value}
                  icon={Icon}
                  title={label}
                  description={<span className="text-body text-ink">{ATTENTION[value]}</span>}
                />
              ))}
            </RadioCardGroup>
          )}

          {/* TODO(Phase 3): wire "sample paper" and "upload my own" to real uploads (docs/backlog.md). */}
          {step === 4 && (
            <div className="flex flex-col gap-3">
              <RadioCardGroup
                aria-label={title}
                value={source ?? ""}
                onValueChange={(v) => setSource(v as Source)}
                className="sm:grid-cols-2"
              >
                <RadioCard
                  value="sample"
                  icon={NotebookText}
                  title="Start with a sample paper"
                  description="Attention Is All You Need: the paper behind today's language models."
                />
                <RadioCard
                  value="upload"
                  icon={FileUp}
                  title="I'll upload my own"
                  description="PDFs, notes, images or CSVs."
                />
              </RadioCardGroup>
              <p className="text-center text-small text-graphite">
                Uploading arrives in the next update; we&apos;ll remember your choice.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-center text-small text-danger-strong">
              {error}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-rule pt-6">
            {step > 1 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep(step - 1)}
                disabled={pending}
              >
                Back
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" loading={pending} disabled={!canContinue}>
              {step === 4 ? "Finish" : "Continue"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

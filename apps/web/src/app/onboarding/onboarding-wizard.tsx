"use client";

import {
  BookOpen,
  Code,
  FileUp,
  GraduationCap,
  Microscope,
  NotebookText,
  Presentation,
  Sprout,
} from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ProgressDots } from "@/components/ui/progress";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import { SelectableTag } from "@/components/ui/tag";
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

const SUBJECTS = [
  "Machine learning & AI",
  "Computer science",
  "Mathematics",
  "Physics",
  "Biology",
  "Electronics",
];
const MAX_SUBJECTS = 8;

const QUESTIONS = [
  "What brings you to TensorLM?",
  "What are you studying?",
  "How should explanations feel?",
  "Add your first source",
];

/** Same idea, three levels (step 3), in the reading face. */
const ATTENTION = {
  beginner:
    "When reading a sentence, the model looks back at the other words and decides which ones help it understand the current word.",
  intermediate:
    "Each word scores every other word for relevance, turns the scores into weights, and mixes the words' information by those weights.",
  expert:
    "softmax(QKᵀ/√dₖ)V: queries and keys give scaled dot-product scores; the softmax weights combine the value vectors.",
};

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
  const [other, setOther] = useState(initial.subjects.find((s) => !SUBJECTS.includes(s)) ?? "");
  const [otherOn, setOtherOn] = useState(Boolean(other));
  const [level, setLevel] = useState<Level>(initial.level);
  const [source, setSource] = useState<Source | null>(initial.firstSource);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const picked = subjects.filter((s) => SUBJECTS.includes(s));
  const allSubjects = [...picked, ...(otherOn && other.trim() ? [other.trim()] : [])];

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

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col gap-8 px-6 py-12 md:py-24">
      <div className="flex items-center justify-between gap-4">
        <p className="text-body font-semibold text-ink">TensorLM</p>
        <Button variant="ghost" size="sm" onClick={skip} disabled={pending}>
          Skip for now
        </Button>
      </div>

      <form
        className="flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <ProgressDots steps={4} current={step} />
            <span className="text-small text-graphite">Step {step} of 4</span>
          </div>
          <div className="flex flex-col gap-1">
            {step === 1 && firstName && (
              <p className="text-body text-graphite">Welcome, {firstName}.</p>
            )}
            <h1 className="text-h1 text-ink">{QUESTIONS[step - 1]}</h1>
          </div>
        </div>

        {step === 1 && (
          <RadioCardGroup
            aria-label={QUESTIONS[0]}
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
            <p className="text-body text-graphite">
              Pick any that fit. You can change these later.
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Subjects">
              {SUBJECTS.map((subject) => (
                <SelectableTag
                  key={subject}
                  className="h-9 px-3 text-body"
                  selected={picked.includes(subject)}
                  disabled={!picked.includes(subject) && allSubjects.length >= MAX_SUBJECTS}
                  onSelectedChange={(on) =>
                    setSubjects((s) => (on ? [...s, subject] : s.filter((x) => x !== subject)))
                  }
                >
                  {subject}
                </SelectableTag>
              ))}
              <SelectableTag
                className="h-9 px-3 text-body"
                selected={otherOn}
                onSelectedChange={setOtherOn}
              >
                Other
              </SelectableTag>
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
            aria-label={QUESTIONS[2]}
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
            ).map(([value, title, Icon]) => (
              <RadioCard
                key={value}
                value={value}
                icon={Icon}
                title={title}
                description={
                  <span className="text-body-read text-ink">
                    <span className="text-small text-graphite">What attention does: </span>
                    {ATTENTION[value]}
                  </span>
                }
              />
            ))}
          </RadioCardGroup>
        )}

        {/* TODO(Phase 3): wire "sample paper" and "upload my own" to real uploads (docs/backlog.md). */}
        {step === 4 && (
          <div className="flex flex-col gap-4">
            <p className="text-body text-graphite">
              Uploading arrives in the next update; we&apos;ll remember your choice.
            </p>
            <RadioCardGroup
              aria-label={QUESTIONS[3]}
              value={source ?? ""}
              onValueChange={(v) => setSource(v as Source)}
              className="grid-cols-1 sm:grid-cols-1"
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
          </div>
        )}

        {error && (
          <p role="alert" className="text-small text-danger-strong">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          {step > 1 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(step - 1)}
              disabled={pending}
            >
              Back
            </Button>
          )}
          <Button type="submit" loading={pending} disabled={!canContinue}>
            {step === 4 ? "Finish" : "Continue"}
          </Button>
        </div>
      </form>
    </main>
  );
}

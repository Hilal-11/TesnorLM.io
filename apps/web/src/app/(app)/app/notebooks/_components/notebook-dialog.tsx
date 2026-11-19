"use client";

import { RadioGroup } from "radix-ui";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { ErrorText, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  COLOR_LABELS,
  COLOR_VARS,
  NOTEBOOK_COLORS,
  SUBJECT_PRESETS,
  notebookCreateSchema,
  type Notebook,
  type NotebookColor,
  type NotebookPatch,
  type NotebookStatus,
} from "@/lib/notebooks/shared";
import { cn } from "@/lib/utils";
import { createNotebook, updateNotebook } from "../actions";
import { asColor } from "./notebook-visuals";

type Fields = {
  title: string;
  description: string;
  subject: string;
  color: NotebookColor;
  exam_date: string;
};

const fieldsOf = (n?: Notebook): Fields => ({
  title: n?.title ?? "",
  description: n?.description ?? "",
  subject: n?.subject ?? "",
  color: asColor(n?.color ?? "cobalt"),
  exam_date: n?.exam_date ?? "",
});

const SUBJECT_OPTIONS = SUBJECT_PRESETS.map((s) => ({ value: s, label: s }));

type NotebookDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this notebook; create a new one when absent. */
  notebook?: Notebook;
  /** New notebooks start in this board column. */
  status?: NotebookStatus;
  /** Put the cursor here first (e.g. "Set exam date" from the card menu). */
  focus?: "exam_date";
  onSaved: (notebook: Notebook) => void;
};

/** Create or edit a notebook: name, description, subject, colour and exam date. */
export function NotebookDialog({ open, onOpenChange, ...props }: NotebookDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && (
          <NotebookForm
            key={props.notebook?.id ?? "new"}
            onDone={() => onOpenChange(false)}
            {...props}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function NotebookForm({
  notebook,
  status = "to_read",
  focus,
  onSaved,
  onDone,
}: Omit<NotebookDialogProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const formId = useId();
  const [fields, setFields] = useState<Fields>(() => fieldsOf(notebook));
  const [base, setBase] = useState(notebook);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields | "form", string>>>({});
  const [pending, startTransition] = useTransition();
  const editing = Boolean(notebook);
  const set = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = notebookCreateSchema.safeParse({ ...fields, status });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]) as keyof Fields;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    startTransition(async () => {
      if (!base) {
        const res = await createNotebook(null, parsed.data);
        if (res?.ok && res.data) {
          onSaved(res.data);
          onDone();
        } else setErrors({ form: res && !res.ok ? res.error : "Try again in a moment." });
        return;
      }
      const original = fieldsOf(base);
      const patch: NotebookPatch = {};
      for (const key of Object.keys(fields) as (keyof Fields)[]) {
        if (fields[key].trim() !== original[key]) {
          Object.assign(patch, { [key]: parsed.data[key as keyof typeof parsed.data] ?? null });
        }
      }
      if (Object.keys(patch).length === 0) return onDone();
      const res = await updateNotebook(null, { id: base.id, updatedAt: base.updated_at, patch });
      if (res?.ok && res.data) {
        onSaved(res.data);
        onDone();
      } else if (res && !res.ok && res.code === "conflict" && res.data) {
        setBase(res.data);
        setFields(fieldsOf(res.data));
        onSaved(res.data);
        setErrors({ form: res.error });
      } else setErrors({ form: res && !res.ok ? res.error : "Try again in a moment." });
    });
  }

  return (
    <>
      <DialogHeader
        title={editing ? "Edit notebook" : "New notebook"}
        description="Group sources by course, topic or exam."
      />
      <DialogBody>
        <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-5">
          <Field label="Name" required error={errors.title}>
            <Input
              value={fields.title}
              onChange={(e) => set("title", e.target.value)}
              maxLength={120}
              autoComplete="off"
              autoFocus={focus !== "exam_date"}
            />
          </Field>
          <Field
            label="Description"
            helper="Optional. What this notebook is for."
            error={errors.description}
          >
            <Textarea
              value={fields.description}
              onChange={(e) => set("description", e.target.value)}
              limit={500}
              minRows={2}
              maxRows={5}
            />
          </Field>
          <Field label="Subject" helper="Pick one or type your own." error={errors.subject}>
            <Combobox
              creatable
              options={
                fields.subject && !SUBJECT_PRESETS.includes(fields.subject as never)
                  ? [...SUBJECT_OPTIONS, { value: fields.subject, label: fields.subject }]
                  : SUBJECT_OPTIONS
              }
              value={fields.subject}
              onValueChange={(v) => set("subject", v)}
              placeholder="Choose a subject"
              searchPlaceholder="Search or type a subject"
            />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-small font-medium text-ink">Colour</legend>
            <RadioGroup.Root
              value={fields.color}
              onValueChange={(v) => set("color", v as NotebookColor)}
              className="flex flex-wrap gap-2"
              aria-label="Colour"
            >
              {NOTEBOOK_COLORS.map((color) => (
                <RadioGroup.Item
                  key={color}
                  value={color}
                  className={cn(
                    "inline-flex h-8 cursor-pointer items-center gap-2 rounded-sm border border-rule bg-sheet pr-3 pl-2 text-small text-ink interactive hover:border-rule-strong",
                    "data-[state=checked]:border-primary data-[state=checked]:ring-1 data-[state=checked]:ring-primary data-[state=checked]:ring-inset",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-3.5 rounded-full"
                    style={{ backgroundColor: COLOR_VARS[color] }}
                  />
                  {COLOR_LABELS[color]}
                </RadioGroup.Item>
              ))}
            </RadioGroup.Root>
          </fieldset>
          <Field label="Exam date" helper="Optional." error={errors.exam_date}>
            <Input
              type="date"
              value={fields.exam_date}
              onChange={(e) => set("exam_date", e.target.value)}
              autoFocus={focus === "exam_date"}
              className="max-w-48"
            />
          </Field>
          {errors.form && <ErrorText role="alert">{errors.form}</ErrorText>}
        </form>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogClose>
        <Button type="submit" form={formId} loading={pending}>
          {editing ? "Save changes" : "Create notebook"}
        </Button>
      </DialogFooter>
    </>
  );
}

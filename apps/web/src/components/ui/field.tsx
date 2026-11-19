"use client";

import { cva } from "class-variance-authority";
import { CircleAlert } from "lucide-react";
import { createContext, use, useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The visual box shared by Input, SearchInput, Textarea, Select and Combobox triggers.
 * Works both on a wrapper (`within-focus`, `has-…`) and on the control itself.
 */
export const fieldBox = cva(
  "interactive flex w-full min-w-0 items-center rounded-sm border border-rule bg-sheet text-ink hover:border-rule-strong focus-visible:border-cobalt within-focus:border-cobalt within-focus:outline-2 within-focus:outline-offset-2 within-focus:outline-ring aria-invalid:border-danger has-[[aria-invalid=true]]:border-danger disabled:cursor-not-allowed disabled:bg-muted disabled:text-graphite has-disabled:cursor-not-allowed has-disabled:bg-muted has-disabled:text-graphite",
  {
    variants: {
      size: {
        md: "h-9 text-body",
        lg: "h-11 text-body",
      },
    },
    defaultVariants: { size: "md" },
  },
);

type FieldContextValue = {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required?: boolean;
  disabled?: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

type ControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
  required?: boolean;
  disabled?: boolean;
};

/** Wires a control to its <Field>: id, aria-describedby, aria-invalid, required, disabled. */
export function useFieldControl(props: ControlProps) {
  const field = use(FieldContext);
  const describedBy = [props["aria-describedby"], field?.describedBy].filter(Boolean).join(" ");
  return {
    id: props.id ?? field?.id,
    "aria-describedby": describedBy || undefined,
    "aria-invalid": props["aria-invalid"] ?? (field?.invalid ? true : undefined),
    required: props.required ?? field?.required,
    disabled: props.disabled ?? field?.disabled,
  };
}

type FieldProps = {
  label: ReactNode;
  /** One line under the control. Hidden while an error shows. */
  helper?: ReactNode;
  /** Say what happened and how to fix it (skill 9). */
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
};

/** Label + control + helper/error, with ids and ARIA wired automatically. */
export function Field({
  label,
  helper,
  error,
  required,
  disabled,
  id: idProp,
  className,
  children,
}: FieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const helperId = helper && !error ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div data-slot="field" className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <FieldContext
        value={{
          id,
          describedBy: errorId ?? helperId,
          invalid: Boolean(error),
          required,
          disabled,
        }}
      >
        {children}
      </FieldContext>
      {error ? (
        <ErrorText id={errorId}>{error}</ErrorText>
      ) : helper ? (
        <HelperText id={helperId}>{helper}</HelperText>
      ) : null}
    </div>
  );
}

export function Label({
  className,
  required,
  children,
  ...props
}: React.ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label className={cn("text-small font-medium text-ink", className)} {...props}>
      {children}
      {required && (
        <span aria-hidden className="text-graphite">
          {" "}
          *
        </span>
      )}
    </label>
  );
}

export function HelperText({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-small text-graphite", className)} {...props} />;
}

export function ErrorText({ className, children, ...props }: React.ComponentProps<"p">) {
  return (
    <p className={cn("flex items-start gap-1 text-small text-danger-strong", className)} {...props}>
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

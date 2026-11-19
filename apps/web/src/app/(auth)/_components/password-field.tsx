"use client";

import { Check, Eye, EyeOff, Minus } from "lucide-react";
import { useId, useState } from "react";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { passwordStrength } from "@/lib/password-strength";
import { cn } from "@/lib/utils";

const METER = { Weak: "bg-danger", OK: "bg-warning", Strong: "bg-success" } as const;

/** Password with show/hide; `showStrength` adds the meter (Weak / OK / Strong) and the rules. */
export function PasswordField({
  label = "Password",
  name = "password",
  autoComplete,
  showStrength = false,
  error,
  autoFocus,
}: {
  label?: string;
  name?: string;
  autoComplete: "current-password" | "new-password";
  showStrength?: boolean;
  error?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const strengthId = useId();
  const strength = passwordStrength(value);

  return (
    <div className="flex flex-col gap-2">
      <Field label={label} error={error} required>
        <Input
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          size="lg"
          aria-describedby={showStrength ? strengthId : undefined}
          suffix={
            <IconButton
              icon={visible ? EyeOff : Eye}
              aria-label={visible ? "Hide password" : "Show password"}
              size="sm"
              tooltip={false}
              className="-mr-2"
              onClick={() => setVisible((v) => !v)}
            />
          }
        />
      </Field>
      {showStrength && (
        <div id={strengthId} className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div aria-hidden className="flex flex-1 gap-1">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    value && n <= strength.score ? METER[strength.word] : "bg-rule",
                  )}
                />
              ))}
            </div>
            <span
              className="w-14 text-right text-small font-medium text-graphite"
              aria-live="polite"
            >
              {value ? strength.word : ""}
            </span>
          </div>
          <ul className="flex flex-col gap-1 text-small text-graphite">
            <Rule ok={strength.rules.length}>At least 8 characters</Rule>
            <Rule ok={strength.rules.numberOrSymbol}>A number or symbol</Rule>
          </ul>
        </div>
      )}
    </div>
  );
}

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icon = ok ? Check : Minus;
  return (
    <li className={cn("flex items-center gap-2", ok && "text-success-strong")}>
      <Icon aria-hidden className="size-3.5" />
      {children}
      <span className="sr-only">{ok ? "(done)" : "(not yet)"}</span>
    </li>
  );
}

"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Called once all digits are filled. */
  onComplete?: (value: string) => void;
  length?: number;
  /** Submitted with forms under this name. */
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  "aria-describedby"?: string;
};

/**
 * One box per digit: typing advances, Backspace on an empty box goes back, a pasted or autofilled
 * code fills every box. Numeric keyboard on phones; each box is labelled "Digit 1 of 6".
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  name,
  disabled,
  invalid,
  autoFocus,
  "aria-describedby": describedBy,
}: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  function commit(next: string[]) {
    const joined = next.join("").slice(0, length);
    onChange(joined);
    if (joined.length === length && !joined.includes(" ")) onComplete?.(joined);
  }

  function fillFrom(index: number, text: string) {
    const incoming = text.replace(/\D/g, "").split("");
    if (incoming.length === 0) return;
    const next = [...digits];
    incoming.slice(0, length - index).forEach((d, k) => (next[index + k] = d));
    commit(next);
    focus(Math.min(length - 1, index + incoming.length));
  }

  return (
    <div role="group" aria-label="Verification code" className="flex w-full justify-between gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const text = e.target.value;
            if (text.length > 1) {
              fillFrom(i, text);
              return;
            }
            const next = [...digits];
            next[i] = text.replace(/\D/g, "");
            commit(next);
            if (next[i]) focus(i + 1);
          }}
          onPaste={(e) => {
            e.preventDefault();
            fillFrom(i, e.clipboardData.getData("text"));
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              e.preventDefault();
              const next = [...digits];
              next[i - 1] = "";
              commit(next);
              focus(i - 1);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              focus(i - 1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              focus(i + 1);
            }
          }}
          className={cn(
            "h-12 w-full max-w-12 min-w-0 flex-1 rounded-sm border border-rule bg-sheet text-center text-h3 font-mono text-ink interactive outline-none hover:border-rule-strong focus-visible:border-cobalt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:bg-muted disabled:text-graphite",
            invalid && "border-danger",
          )}
        />
      ))}
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}

"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { fieldBox, useFieldControl } from "@/components/ui/field";
import { mergeRefs } from "@/lib/merge-refs";
import { cn } from "@/lib/utils";

type TextareaProps = React.ComponentProps<"textarea"> & {
  /** Grows from minRows to maxRows, then scrolls (composer behaviour, skill 8.3). */
  minRows?: number;
  maxRows?: number;
  /** Shows a character counter: warning from 90%, danger over the limit. */
  limit?: number;
  "data-force"?: string;
};

export function Textarea({
  minRows = 1,
  maxRows = 8,
  limit,
  className,
  ref,
  onChange,
  "data-force": force,
  ...props
}: TextareaProps) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  const [typedLength, setTypedLength] = useState(String(props.defaultValue ?? "").length);
  const counterId = useId();
  const field = useFieldControl(props);
  const length = props.value !== undefined ? String(props.value).length : typedLength;

  const resize = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const line = parseFloat(style.lineHeight) || 24;
    const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const min = line * minRows + padding;
    const max = line * maxRows + padding;
    el.style.height = "auto";
    const content = el.scrollHeight;
    el.style.height = `${Math.min(Math.max(content, min), max)}px`;
    el.style.overflowY = content > max ? "auto" : "hidden";
  }, [minRows, maxRows]);

  useLayoutEffect(resize, [resize, props.value]);

  const ratio = limit ? length / limit : 0;
  const describedBy = [field["aria-describedby"], limit ? counterId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("flex w-full flex-col gap-1", className)}>
      <div
        data-slot="textarea"
        data-force={force}
        className={cn(fieldBox(), "h-auto items-stretch")}
      >
        <textarea
          rows={minRows}
          {...props}
          {...field}
          aria-describedby={describedBy || undefined}
          ref={mergeRefs(ref, innerRef)}
          onChange={(e) => {
            setTypedLength(e.target.value.length);
            onChange?.(e);
            resize();
          }}
          className="min-w-0 flex-1 resize-none bg-transparent px-3 py-2 text-inherit outline-none placeholder:text-graphite disabled:cursor-not-allowed"
        />
      </div>
      {limit && (
        <p
          id={counterId}
          className={cn(
            "self-end text-small tabular-nums",
            ratio > 1
              ? "text-danger-strong"
              : ratio >= 0.9
                ? "text-warning-strong"
                : "text-graphite",
          )}
        >
          {length} / {limit}
        </p>
      )}
    </div>
  );
}

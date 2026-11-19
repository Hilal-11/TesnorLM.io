"use client";

import { Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { fieldBox, useFieldControl } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { inputElement } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { mergeRefs } from "@/lib/merge-refs";
import { cn } from "@/lib/utils";

type SearchInputProps = Omit<React.ComponentProps<"input">, "size" | "value" | "defaultValue"> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Shortcut hint shown while empty. */
  shortcut?: string[];
  size?: "md" | "lg";
  "data-force"?: string;
};

/** Search field: icon, clear button when filled, shortcut hint when empty. Esc clears, then blurs. */
export function SearchInput({
  value,
  defaultValue = "",
  onValueChange,
  shortcut = ["mod", "K"],
  placeholder = "Search sources",
  size,
  className,
  ref,
  onKeyDown,
  "data-force": force,
  ...props
}: SearchInputProps) {
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const inputRef = useRef<HTMLInputElement>(null);
  const field = useFieldControl(props);

  const set = (next: string) => {
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };

  return (
    <div data-slot="search-input" data-force={force} className={cn(fieldBox({ size }), className)}>
      <Search aria-hidden className="ml-3 size-4 shrink-0 text-graphite" />
      <input
        type="search"
        role="searchbox"
        placeholder={placeholder}
        {...props}
        {...field}
        ref={mergeRefs(ref, inputRef)}
        value={current}
        onChange={(e) => set(e.target.value)}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.key !== "Escape" || e.defaultPrevented) return;
          e.preventDefault();
          if (current) set("");
          else inputRef.current?.blur();
        }}
        className={cn(inputElement, "pl-2 [&::-webkit-search-cancel-button]:appearance-none")}
      />
      {current ? (
        <IconButton
          icon={X}
          aria-label="Clear search"
          size="sm"
          className="mr-0.5"
          onClick={() => {
            set("");
            inputRef.current?.focus();
          }}
        />
      ) : (
        shortcut && <Kbd keys={shortcut} className="mr-2" />
      )}
    </div>
  );
}

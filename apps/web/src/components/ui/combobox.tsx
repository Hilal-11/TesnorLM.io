"use client";

import { Command } from "cmdk";
import { Check, ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import { fieldBox, useFieldControl } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";

export type ComboboxOption = { value: string; label: string };

type Common = {
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  size?: "md" | "lg";
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "data-force"?: string;
};

type ComboboxProps = Common &
  (
    | {
        multiple?: false;
        value?: string;
        defaultValue?: string;
        onValueChange?: (v: string) => void;
      }
    | {
        multiple: true;
        value?: string[];
        defaultValue?: string[];
        onValueChange?: (v: string[]) => void;
      }
  );

const comboItem =
  "relative flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-body text-ink outline-none select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent";

/** Searchable select (cmdk in a popover). Optional multi-select with removable tags. */
export function Combobox(props: ComboboxProps) {
  const {
    options,
    placeholder = "Choose…",
    searchPlaceholder = "Search",
    size,
    className,
    "data-force": force,
  } = props;
  const field = useFieldControl(props);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [inner, setInner] = useState<string[]>(() => {
    const d = props.defaultValue;
    return d === undefined ? [] : Array.isArray(d) ? d : [d];
  });

  const selected: string[] =
    props.value === undefined ? inner : Array.isArray(props.value) ? props.value : [props.value];
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;

  function commit(next: string[]) {
    if (props.value === undefined) setInner(next);
    if (props.multiple) props.onValueChange?.(next);
    else props.onValueChange?.(next[0] ?? "");
  }

  function choose(value: string) {
    if (props.multiple) {
      commit(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
    } else {
      commit([value]);
      setOpen(false);
    }
  }

  const triggerText =
    !props.multiple && selected[0] ? (
      <span className="truncate">{labelOf(selected[0])}</span>
    ) : (
      <span className="truncate text-graphite">{placeholder}</span>
    );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <div
        data-slot="combobox"
        data-force={force}
        className={cn(
          fieldBox({ size }),
          props.multiple && selected.length > 0 && "h-auto min-h-9 flex-wrap gap-1 py-1 pl-1",
          className,
        )}
      >
        {props.multiple &&
          selected.map((v) => (
            <Tag key={v} onRemove={() => choose(v)}>
              {labelOf(v)}
            </Tag>
          ))}
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={props["aria-label"]}
            {...field}
            className="flex h-full min-h-7 min-w-24 flex-1 cursor-pointer items-center justify-between gap-2 px-3 text-left outline-none disabled:cursor-not-allowed"
          >
            {props.multiple && selected.length > 0 ? (
              <span className="text-small text-graphite">Add more</span>
            ) : (
              triggerText
            )}
            <ChevronDown aria-hidden className="size-4 shrink-0 text-graphite" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-60 p-0">
        <Command loop>
          <div className="flex items-center gap-2 border-b border-rule px-3">
            <Search aria-hidden className="size-4 shrink-0 text-graphite" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
              className="h-9 w-full bg-transparent text-body text-ink outline-none placeholder:text-graphite"
            />
          </div>
          <Command.List className="max-h-64 overflow-y-auto p-1">
            <Command.Empty className="px-2 py-4 text-small text-graphite">
              No matches for &ldquo;{query}&rdquo;
            </Command.Empty>
            {options.map((option) => (
              <Command.Item
                key={option.value}
                value={option.label}
                onSelect={() => choose(option.value)}
                className={comboItem}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {selected.includes(option.value) && (
                  <Check aria-hidden className="size-4 shrink-0 text-primary" />
                )}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { ArrowUp, AtSign, FileText, Quote, Slash, Square, X } from "lucide-react";
import { useId, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  COMMANDS,
  commandLabel,
  FORMAT_COMMANDS,
  LEVELS,
  levelLabel,
  LIMITS,
  type Command,
  type Level,
} from "@/lib/answers/format";
import type { Attachment } from "@/lib/chats/shared";
import { cn } from "@/lib/utils";

export type ComposerSource = { id: string; title: string };
export type ComposerHandle = { focus: () => void; setText: (text: string) => void };
export type ComposerSubmit = {
  message: string;
  command?: Command;
  attachments: Attachment[];
  documentIds?: string[];
};

type MenuItem = { key: string; label: string; hint: string; kind: "command" | "source" };

/** The word being typed at the caret when it starts with "/" (at the start) or "@". */
function trigger(text: string, caret: number) {
  const before = text.slice(0, caret);
  const slash = /^\/(\w*)$/.exec(before);
  if (slash) return { kind: "command" as const, query: slash[1].toLowerCase(), start: 0 };
  const at = /(^|\s)@([^\s@]*)$/.exec(before);
  if (at) return { kind: "source" as const, query: at[2].toLowerCase(), start: before.length - at[2].length - 1 };
  return null;
}

type ComposerProps = {
  ref?: Ref<ComposerHandle>;
  level: Level;
  onLevel: (level: Level) => void;
  sources: ComposerSource[];
  /** Ready + included sources out of all sources, for "Asking k of n sources". */
  asking: { k: number; n: number };
  attachments: Attachment[];
  attachmentTitle: (documentId: string) => string;
  onRemoveAttachment: (index: number) => void;
  busy: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onSubmit: (input: ComposerSubmit) => void;
  onStop: () => void;
};

/**
 * Prompt box (skill 8.3): grows to 8 lines; Enter sends, Shift+Enter adds a line; "/" opens the
 * commands, "@" picks sources for this question; quotes from the PDF ride along as chips.
 */
export function Composer({
  ref,
  level,
  onLevel,
  sources,
  asking,
  attachments,
  attachmentTitle,
  onRemoveAttachment,
  busy,
  disabled = false,
  disabledReason,
  onSubmit,
  onStop,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [command, setCommand] = useState<Command | null>(null);
  const [picked, setPicked] = useState<ComposerSource[]>([]);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const hintId = useId();

  useImperativeHandle(ref, () => ({
    focus: () => input.current?.focus(),
    setText: (t: string) => {
      setText(t);
      requestAnimationFrame(() => {
        input.current?.focus();
        input.current?.setSelectionRange(t.length, t.length);
      });
    },
  }));

  const t = trigger(text, caret);
  const menuKey = t ? `${t.kind}:${t.start}` : null;
  const items = useMemo<MenuItem[]>(() => {
    if (!t) return [];
    if (t.kind === "command")
      return COMMANDS.filter((c) => c.startsWith(t.query) || commandLabel(c).toLowerCase().includes(t.query)).map((c) => ({
        key: c,
        label: `/${c}`,
        hint: FORMAT_COMMANDS[c].description,
        kind: "command",
      }));
    return sources
      .filter((s) => !picked.some((p) => p.id === s.id) && s.title.toLowerCase().includes(t.query))
      .slice(0, 8)
      .map((s) => ({ key: s.id, label: s.title, hint: "Ask only this source", kind: "source" }));
  }, [t, sources, picked]);
  const open = items.length > 0 && menuKey !== dismissed;
  const current = Math.min(active, Math.max(items.length - 1, 0));

  const choose = (item: MenuItem) => {
    if (!t) return;
    const rest = text.slice(caret);
    const next = text.slice(0, t.start) + rest.replace(/^\S*/, "").replace(/^\s/, "");
    if (item.kind === "command") setCommand(item.key as Command);
    else {
      const source = sources.find((s) => s.id === item.key);
      if (source) setPicked((p) => [...p, source]);
    }
    setText(next);
    setActive(0);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(t.start, t.start);
      setCaret(t.start);
    });
  };

  const trimmed = text.trim();
  const canSend = !disabled && !busy && (trimmed.length > 0 || command !== null) && text.length <= LIMITS.messageChars;

  const submit = () => {
    if (!canSend) return;
    onSubmit({
      message: trimmed,
      command: command ?? undefined,
      attachments,
      documentIds: picked.length > 0 ? picked.map((p) => p.id) : undefined,
    });
    setText("");
    setCommand(null);
    setPicked([]);
  };

  const levelOptions = LEVELS.map((l) => ({ value: l, label: levelLabel(l) }));

  return (
    <div data-slot="composer" className="flex flex-col gap-2">
      <div
        className={cn(
          "relative flex flex-col gap-2 rounded-lg border border-rule bg-sheet p-2 shadow-1 transition-shadow duration-(--dur-fast)",
          "focus-within:border-rule-strong focus-within:shadow-2",
          disabled && "opacity-70",
        )}
      >
        {(attachments.length > 0 || picked.length > 0 || command) && (
          <ul className="flex flex-wrap gap-1.5 px-1 pt-1" aria-label="Added to this question">
            {command && (
              <li className="inline-flex h-7 items-center gap-1 rounded-sm bg-muted pr-0.5 pl-2 text-small text-ink">
                <Slash aria-hidden className="size-3.5 text-graphite" />
                {commandLabel(command)}
                <IconButton icon={X} size="sm" aria-label={`Remove ${commandLabel(command)}`} tooltip={false} onClick={() => setCommand(null)} />
              </li>
            )}
            {picked.map((s) => (
              <li key={s.id} className="inline-flex h-7 max-w-60 items-center gap-1 rounded-sm bg-muted pr-0.5 pl-2 text-small text-ink">
                <FileText aria-hidden className="size-3.5 shrink-0 text-graphite" />
                <span className="truncate">{s.title}</span>
                <IconButton
                  icon={X}
                  size="sm"
                  aria-label={`Stop asking only ${s.title}`}
                  tooltip={false}
                  onClick={() => setPicked((p) => p.filter((x) => x.id !== s.id))}
                />
              </li>
            ))}
            {attachments.map((a, i) => (
              <li key={i} className="inline-flex h-7 max-w-72 items-center gap-1 rounded-sm bg-highlight/60 pr-0.5 pl-2 text-small text-ink">
                <Quote aria-hidden className="size-3.5 shrink-0 text-graphite" />
                <span className="truncate">“{a.text}”</span>
                <span className="shrink-0 text-caption text-graphite">
                  {attachmentTitle(a.document_id)} p. {a.page}
                </span>
                <IconButton icon={X} size="sm" aria-label="Remove quote" tooltip={false} onClick={() => onRemoveAttachment(i)} />
              </li>
            ))}
          </ul>
        )}

        <textarea
          ref={input}
          rows={1}
          value={text}
          disabled={disabled}
          maxLength={LIMITS.messageChars + 200}
          placeholder={disabled ? (disabledReason ?? "Add a source to ask questions") : "Ask about your sources…  / for commands, @ for a source"}
          aria-label="Ask a question"
          aria-describedby={hintId}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${listId}-${current}` : undefined}
          className="field-sizing-content max-h-[calc(8lh+1rem)] min-h-10 w-full resize-none bg-transparent px-2 py-1.5 text-body text-ink outline-none placeholder:text-graphite"
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart);
            setActive(0);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (open) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const step = e.key === "ArrowDown" ? 1 : -1;
                setActive((current + step + items.length) % items.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                choose(items[current]);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setDismissed(menuKey);
                return;
              }
            }
            if (e.key === "Backspace" && text === "" && command) {
              setCommand(null);
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />

        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={t?.kind === "command" ? "Commands" : "Sources"}
            className="absolute bottom-full left-2 z-20 mb-2 max-h-72 w-[min(22rem,calc(100%-1rem))] overflow-y-auto rounded-md border border-rule bg-sheet-2 p-1 shadow-3"
          >
            {items.map((item, i) => (
              <li
                key={item.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === current}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(item);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer flex-col rounded-sm px-2.5 py-1.5",
                  i === current ? "bg-muted" : "",
                )}
              >
                <span className={cn("truncate text-small text-ink", item.kind === "command" && "font-mono")}>{item.label}</span>
                <span className="truncate text-caption text-graphite">{item.hint}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2 px-1">
          <SegmentedControl
            aria-label="Explanation level"
            options={levelOptions}
            value={level}
            onValueChange={(v) => onLevel(v as Level)}
            className="text-caption"
          />
          <IconButton
            icon={AtSign}
            size="sm"
            aria-label="Ask only some sources"
            disabled={disabled}
            onClick={() => {
              const next = text && !/\s$/.test(text) ? `${text} @` : `${text}@`;
              setText(next);
              setCaret(next.length);
              setDismissed(null);
              requestAnimationFrame(() => {
                input.current?.focus();
                input.current?.setSelectionRange(next.length, next.length);
              });
            }}
          />
          <span className="ml-auto flex items-center gap-2">
            {text.length > LIMITS.messageChars * 0.9 && (
              <span className={cn("text-caption tabular-nums", text.length > LIMITS.messageChars ? "text-danger" : "text-graphite")}>
                {text.length} / {LIMITS.messageChars}
              </span>
            )}
            {busy ? (
              <IconButton icon={Square} variant="secondary" aria-label="Stop" shortcut={["Esc"]} onClick={onStop} />
            ) : (
              <IconButton
                icon={ArrowUp}
                variant="primary"
                aria-label="Send"
                shortcut={["enter"]}
                aria-disabled={!canSend}
                onClick={submit}
              />
            )}
          </span>
        </div>
      </div>
      <p id={hintId} className="px-1 text-caption text-graphite">
        {picked.length > 0
          ? `Asking ${picked.length} chosen ${picked.length === 1 ? "source" : "sources"}`
          : `Asking ${asking.k} of ${asking.n} ${asking.n === 1 ? "source" : "sources"}`}
        <span className="hidden sm:inline"> · Enter to send, Shift+Enter for a new line</span>
      </p>
    </div>
  );
}

"use client";

import {
  ArrowDown,
  Check,
  ChevronDown,
  Lightbulb,
  ListChecks,
  MessageSquarePlus,
  Network,
  NotebookText,
  Pencil,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from "react";
import type { DiagramHandlers } from "@/components/answer/diagram-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { commandTemplate, type Command, type Level } from "@/lib/answers/format";
import type { Attachment, Chat, ChatMessage, Citation } from "@/lib/chats/shared";
import { cn } from "@/lib/utils";
import { createChat, deleteChat, loadMessages, renameChat, restoreChat, setChatLevel } from "../../chat-actions";
import { Composer, type ComposerHandle, type ComposerSource, type ComposerSubmit } from "./composer";
import { AssistantMessage, UserMessage } from "./message";
import { useChatStream, type ThreadMessage } from "./use-chat-stream";

const STARTERS: { command: Command; label: string; icon: typeof Lightbulb }[] = [
  { command: "summarize", label: "Summarize the main ideas", icon: NotebookText },
  { command: "explain", label: "Explain the key concept simply", icon: Lightbulb },
  { command: "diagram", label: "Draw how it works", icon: Network },
  { command: "quiz", label: "Quiz me on it", icon: ListChecks },
];

export type ChatPanelHandle = {
  focus: () => void;
  /** Send a question from outside (e.g. "Explain" on a PDF selection). */
  ask: (input: ComposerSubmit) => void;
};

type ChatPanelProps = {
  ref?: Ref<ChatPanelHandle>;
  notebookId: string;
  initialChats: Chat[];
  initialChatId: string | null;
  initialMessages: ChatMessage[];
  defaultLevel: Level;
  sources: ComposerSource[];
  asking: { k: number; n: number };
  /** Why asking isn't possible yet (no ready sources), or null. */
  blocked: string | null;
  attachments: Attachment[];
  onAttachmentsChange: (a: Attachment[]) => void;
  attachmentTitle: (documentId: string) => string;
  onOpenCitation: (c: Citation) => void;
  onOpenDiagram: (code: string, title: string) => void;
};

function diagramHandlers(messageId: string, onOpenCanvas: DiagramHandlers["onOpenCanvas"]): DiagramHandlers {
  const persisted = !messageId.startsWith("temp-");
  return {
    onRepair: persisted
      ? async (code, error) => {
          const res = await apiFetch("/api/diagram/repair", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ messageId, code, error }),
          });
          if (!res.ok) return null;
          return ((await res.json()) as { code: string | null }).code;
        }
      : undefined,
    onRepaired: persisted
      ? (from, to) =>
          void apiFetch("/api/diagram/repair", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ messageId, from, to }),
          })
      : undefined,
    onOpenCanvas,
  };
}

/** The conversation column: chat switcher, the thread, and the prompt box. */
export function ChatPanel(props: ChatPanelProps) {
  const { notebookId, initialChats, initialChatId, initialMessages, defaultLevel } = props;
  const [chats, setChats] = useState(initialChats);
  const [chatId, setChatId] = useState(initialChatId);
  const [thread, setThread] = useState({ key: initialChatId ?? "new", messages: initialMessages });
  const [loading, setLoading] = useState(false);
  const chat = chats.find((c) => c.id === chatId) ?? null;

  const open = useCallback(async (id: string | null) => {
    if (id === null) {
      setChatId(null);
      setThread({ key: `new-${Date.now()}`, messages: [] });
      return;
    }
    setLoading(true);
    const res = await loadMessages(undefined as never, { id });
    setLoading(false);
    if (!res?.ok || !res.data) return void toast.error("Couldn't open that chat");
    setChatId(id);
    setThread({ key: id, messages: res.data as ChatMessage[] });
    const url = new URL(window.location.href);
    url.searchParams.set("chat", id);
    window.history.replaceState(null, "", url);
  }, []);

  const rename = async () => {
    if (!chat) return;
    const title = window.prompt("Rename chat", chat.title ?? "")?.trim();
    if (!title) return;
    const res = await renameChat(undefined as never, { id: chat.id, title });
    if (res?.ok) setChats((list) => list.map((c) => (c.id === chat.id ? { ...c, title, title_generated: false } : c)));
    else toast.error("Couldn't rename the chat", { description: res && !res.ok ? res.error : undefined });
  };

  const remove = async () => {
    if (!chat) return;
    const removed = chat;
    setChats((list) => list.filter((c) => c.id !== removed.id));
    void open(null);
    const res = await deleteChat(undefined as never, { id: removed.id });
    if (!res?.ok) {
      setChats((list) => [removed, ...list]);
      return void toast.error("Couldn't delete the chat");
    }
    toast.success("Chat deleted", {
      duration: 8000,
      action: {
        label: "Undo",
        onClick: async () => {
          const undo = await restoreChat(undefined as never, { id: removed.id });
          if (undo?.ok) {
            setChats((list) => [removed, ...list]);
            void open(removed.id);
          }
        },
      },
    });
  };

  return (
    <section aria-label="Chat" className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-rule px-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="interactive inline-flex min-w-0 items-center gap-1 rounded-sm px-2 py-1 text-small font-medium text-ink hover:bg-muted"
            >
              <span className="truncate">{chat?.title ?? (chat ? "Untitled chat" : "New chat")}</span>
              <ChevronDown aria-hidden className="size-3.5 shrink-0 text-graphite" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-96 w-72 overflow-y-auto">
            <DropdownMenuItem onSelect={() => void open(null)}>
              <MessageSquarePlus aria-hidden /> New chat
            </DropdownMenuItem>
            {chats.length > 0 && <DropdownMenuSeparator />}
            {chats.length > 0 && <DropdownMenuLabel>Chats in this notebook</DropdownMenuLabel>}
            {chats.map((c) => (
              <DropdownMenuItem key={c.id} onSelect={() => void open(c.id)}>
                <Check aria-hidden className={cn(c.id === chatId ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{c.title ?? "Untitled chat"}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="flex-1" />
        {chat && <IconButton icon={Pencil} size="sm" aria-label="Rename chat" onClick={() => void rename()} />}
        {chat && <IconButton icon={Trash2} size="sm" aria-label="Delete chat" onClick={() => void remove()} />}
        <IconButton icon={MessageSquarePlus} size="sm" aria-label="New chat" onClick={() => void open(null)} />
      </div>

      {loading ? (
        <div className="flex flex-1 flex-col gap-4 p-6" aria-busy="true" aria-label="Opening the chat">
          <Skeleton className="ml-auto h-9 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <Thread
          key={thread.key}
          {...props}
          chatId={chatId}
          chat={chat}
          initialMessages={thread.messages}
          defaultLevel={(chat?.level as Level | undefined) ?? defaultLevel}
          onChatCreated={(created) => {
            setChats((list) => [created, ...list]);
            setChatId(created.id);
            const url = new URL(window.location.href);
            url.searchParams.set("chat", created.id);
            window.history.replaceState(null, "", url);
          }}
          notebookId={notebookId}
        />
      )}
    </section>
  );
}

function Thread({
  ref,
  notebookId,
  chatId,
  chat,
  initialMessages,
  defaultLevel,
  sources,
  asking,
  blocked,
  attachments,
  onAttachmentsChange,
  attachmentTitle,
  onOpenCitation,
  onOpenDiagram,
  onChatCreated,
}: ChatPanelProps & {
  chatId: string | null;
  chat: Chat | null;
  onChatCreated: (chat: Chat) => void;
}) {
  const { messages, live, busy, ask, regenerate, resume, stop } = useChatStream(chatId, initialMessages);
  const [level, setLevel] = useState<Level>(defaultLevel);
  const [shown, setShown] = useState<Record<string, string>>({});
  const composer = useRef<ComposerHandle>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);

  const send = useCallback(
    async (input: ComposerSubmit) => {
      let id = chatId;
      if (!id) {
        const res = await createChat(undefined as never, { notebookId, level });
        if (!res?.ok || !res.data) return void toast.error("Couldn't start a chat", { description: res && !res.ok ? res.error : undefined });
        onChatCreated(res.data as Chat);
        id = (res.data as Chat).id;
      }
      onAttachmentsChange([]);
      setPinned(true);
      await ask({ ...input, chatId: id, level });
    },
    [chatId, notebookId, level, onChatCreated, onAttachmentsChange, ask],
  );

  // Exposed to the workspace (PDF selection → Explain).
  const handle = useMemo<ChatPanelHandle>(
    () => ({ focus: () => composer.current?.focus(), ask: (input) => void send(input) }),
    [send],
  );
  useEffect(() => {
    if (!ref) return;
    if (typeof ref === "function") ref(handle);
    else ref.current = handle;
  }, [ref, handle]);

  const changeLevel = (next: Level) => {
    setLevel(next);
    if (chatId) void setChatLevel(undefined as never, { id: chatId, level: next });
  };

  // Keep the newest text in view while it streams, unless the reader scrolled up.
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned) el.scrollTop = el.scrollHeight;
  }, [messages, pinned]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && busy) stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, stop]);

  const turns = useMemo(() => {
    const answers = new Map<string, ThreadMessage[]>();
    for (const m of messages) {
      if (m.role !== "assistant" || !m.parentId) continue;
      answers.set(m.parentId, [...(answers.get(m.parentId) ?? []), m].sort((a, b) => a.version - b.version));
    }
    return messages
      .filter((m) => m.role === "user")
      .map((question) => {
        const versions = answers.get(question.id) ?? [];
        const pick = versions.find((v) => v.id === shown[question.id]) ?? versions.at(-1) ?? null;
        return { question, versions, answer: pick };
      });
  }, [messages, shown]);

  const lastAnswerId = turns.at(-1)?.answer?.id;
  const diagram = useCallback((id: string) => diagramHandlers(id, onOpenDiagram), [onOpenDiagram]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        className="relative min-h-0 flex-1 overflow-y-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
        }}
      >
        <div className="mx-auto flex w-full max-w-[46rem] flex-col gap-8 px-4 py-6 md:px-6">
          {turns.length === 0 ? (
            <div className="flex flex-col items-start gap-4 pt-[8vh]">
              <h2 className="text-h2 text-ink">{chat?.title ?? "Ask about your sources"}</h2>
              <p className="max-w-prose text-body text-graphite">
                {blocked ?? "Answers cite the exact page they come from. Click a citation to see it in the PDF."}
              </p>
              {!blocked && (
                <div className="grid w-full gap-2 sm:grid-cols-2">
                  {STARTERS.map(({ command, label, icon: Icon }) => (
                    <button
                      key={command}
                      type="button"
                      onClick={() => void send({ message: label, command, attachments: [] })}
                      className="interactive flex items-center gap-2 rounded-md border border-rule bg-sheet px-3 py-2.5 text-left text-small text-ink shadow-1 hover:bg-muted"
                      title={commandTemplate(command)}
                    >
                      <Icon aria-hidden className="size-4 shrink-0 text-graphite" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            turns.map(({ question, versions, answer }) => (
              <div key={question.id} className="flex flex-col gap-4">
                <UserMessage message={question} />
                {answer && (
                  <AssistantMessage
                    message={answer}
                    live={live}
                    versions={versions}
                    onVersion={(id) => setShown((s) => ({ ...s, [question.id]: id }))}
                    isLast={answer.id === lastAnswerId}
                    busy={busy}
                    onRegenerate={(m) => {
                      setShown((s) => {
                        const next = { ...s };
                        delete next[question.id];
                        return next;
                      });
                      void regenerate(m, level);
                    }}
                    onContinue={(m) => void resume(m, level)}
                    onFollowup={(q) => void send({ message: q, attachments: [] })}
                    onOpenCitation={onOpenCitation}
                    diagram={diagram(answer.id)}
                  />
                )}
              </div>
            ))
          )}
        </div>
        {!pinned && turns.length > 0 && (
          <Button
            size="sm"
            variant="secondary"
            leadingIcon={ArrowDown}
            className="sticky bottom-3 left-1/2 -translate-x-1/2"
            onClick={() => {
              setPinned(true);
              scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
            }}
          >
            Latest
          </Button>
        )}
      </div>
      <div className="mx-auto w-full max-w-[46rem] shrink-0 px-4 pb-4 md:px-6">
        <Composer
          ref={composer}
          level={level}
          onLevel={changeLevel}
          sources={sources}
          asking={asking}
          attachments={attachments}
          attachmentTitle={attachmentTitle}
          onRemoveAttachment={(i) => onAttachmentsChange(attachments.filter((_, j) => j !== i))}
          busy={busy}
          disabled={blocked !== null}
          disabledReason={blocked ?? undefined}
          onSubmit={(input) => void send(input)}
          onStop={stop}
        />
      </div>
    </div>
  );
}

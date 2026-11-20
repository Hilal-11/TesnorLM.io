"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { toast } from "@/components/ui/toast";
import { useMediaQuery } from "@/hooks/use-media-query";
import { apiFetch } from "@/lib/api-client";
import type { Level } from "@/lib/answers/format";
import type { Attachment, Chat, ChatMessage, Citation } from "@/lib/chats/shared";
import { backgroundTitle } from "@/lib/documents/live";
import { isPdfName, type Source } from "@/lib/documents/shared";
import type { Notebook } from "@/lib/notebooks/shared";
import { getUploadManager, useUploads } from "@/lib/uploads/browser";
import { cn } from "@/lib/utils";
import { MAX_FILES } from "@/lib/uploads/manager";
import { touchNotebook } from "../../actions";
import { ColorDot, StatusWord, formatExamDate } from "../../_components/notebook-visuals";
import { createNote, setSourceIncluded } from "../chat-actions";
import { Canvas, type CanvasTab } from "./canvas/canvas";
import type { PdfFocus, PdfSelection } from "./canvas/pdf-viewer";
import { ChatPanel, type ChatPanelHandle } from "./chat/chat-panel";
import { SourcesPanel } from "./sources-panel";
import { UploadDialog } from "./upload-dialog";
import { useLiveSources } from "./use-live-sources";
import { WindowDropZone } from "./window-drop";

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(
    el?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"),
  );
}

async function errorText(res: Response) {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? "Try again in a moment.";
}

/**
 * A notebook workspace: Sources · Chat · Canvas (the cited PDF or a diagram) in resizable panes
 * on wide screens; one pane at a time with tabs on narrow ones.
 */
export function NotebookWorkspace({
  notebook,
  initialSources,
  initialChats,
  initialChatId,
  initialMessages,
  defaultLevel,
}: {
  notebook: Notebook;
  initialSources: Source[];
  initialChats: Chat[];
  initialChatId: string | null;
  initialMessages: ChatMessage[];
  defaultLevel: Level;
}) {
  const { sources, setSources, connection } = useLiveSources(notebook.id, initialSources);
  const { items } = useUploads();
  const uploads = items.filter((i) => i.notebookId === notebook.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const params = useSearchParams();
  const [uploadOpen, setUploadOpen] = useState(() => params.get("add") === "1");

  // Counts as "opened" only when someone actually looks at it (not on link prefetch).
  useEffect(() => {
    void touchNotebook(null, { id: notebook.id });
  }, [notebook.id]);

  const addFiles = useCallback(
    (files: File[]) => {
      const { refused } = getUploadManager().add(notebook.id, files);
      if (refused > 0) {
        toast.error(`${refused} ${refused === 1 ? "file wasn't" : "files weren't"} added`, {
          description: `Add up to ${MAX_FILES} files at a time, then add the rest.`,
        });
      }
    },
    [notebook.id],
  );

  // From onboarding: ?add=1 opens Add sources; ?sample=1 adds the sample paper (once).
  // (params is read above: the dialog starts open for ?add=1)
  const router = useRouter();
  const pathname = usePathname();
  const handledIntro = useRef(false);
  useEffect(() => {
    const add = params.get("add") === "1";
    const sample = params.get("sample") === "1";
    if (handledIntro.current || (!add && !sample)) return;
    handledIntro.current = true;
    router.replace(pathname, { scroll: false });
    if (add) return; // the dialog already started open (initial state below the URL)
    void (async () => {
      const res = await fetch("/samples/sample-paper.pdf").catch(() => null);
      if (!res?.ok) {
        toast.info("The sample paper isn't available yet", {
          description: "Add one of your own PDFs to get started.",
        });
        setUploadOpen(true);
        return;
      }
      const blob = await res.blob();
      addFiles([new File([blob], "sample-paper.pdf", { type: "application/pdf" })]);
    })();
  }, [params, pathname, router, addFiles]);

  // Ctrl/⌘ U opens "Add sources"; pasting a PDF adds it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        setUploadOpen(true);
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter(
        (f) => f.type === "application/pdf" || isPdfName(f.name),
      );
      if (files.length === 0) return;
      e.preventDefault();
      addFiles(files);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [addFiles]);

  // In a background tab the title shows progress: "(2 reading) Transformers — TensorLM".
  useEffect(() => {
    const update = () => {
      document.title = document.hidden
        ? backgroundTitle(notebook.title, sources)
        : `${notebook.title} — TensorLM`;
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [notebook.title, sources]);

  const handlers = {
    onSelect: (id: string) => setSelectedId((current) => (current === id ? null : id)),
    onAddSource: () => setUploadOpen(true),
    onReprocess: async (source: Source) => {
      const res = await apiFetch(`/api/documents/${source.id}/reprocess`, { method: "POST" });
      if (res.ok) toast.success("Reading the file again");
      else if (res.status !== 401)
        toast.error("Couldn't read it again", { description: await errorText(res) });
    },
    onCancelUpload: async (source: Source) => {
      const local = uploads.find((u) => u.documentId === source.id);
      if (local) return void getUploadManager().cancel(local.key);
      const res = await apiFetch(`/api/documents/${source.id}/cancel`, { method: "POST" });
      if (res.ok) setSources((list) => list.filter((s) => s.id !== source.id));
    },
    /** Delete with Undo (8 s), no confirmation (skill 8.4). Hidden at once. */
    onDelete: async (source: Source) => {
      setSources((list) => list.filter((s) => s.id !== source.id));
      if (selectedId === source.id) setSelectedId(null);
      const res = await apiFetch(`/api/documents/${source.id}`, { method: "DELETE" });
      if (!res.ok) {
        setSources((list) =>
          [...list, source].sort((a, b) => a.created_at.localeCompare(b.created_at)),
        );
        toast.error("Couldn't delete the source", { description: await errorText(res) });
        return;
      }
      toast.success("Source deleted", {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await apiFetch(`/api/documents/${source.id}/restore`, { method: "POST" });
            if (undo.ok) {
              setSources((list) =>
                list.some((s) => s.id === source.id)
                  ? list
                  : [...list, { ...source, deleted_at: null }].sort((a, b) =>
                      a.created_at.localeCompare(b.created_at),
                    ),
              );
            } else
              toast.error("Couldn't restore the source", { description: await errorText(undo) });
          },
        },
      });
    },
  };

  // ── Chat · canvas wiring ──
  const isWide = useMediaQuery("(min-width: 1024px)", true);
  const [mobilePane, setMobilePane] = useState<"sources" | "chat" | "canvas">("chat");
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [canvasTab, setCanvasTab] = useState<CanvasTab>("source");
  const [canvasSourceId, setCanvasSourceId] = useState<string | null>(null);
  const [focus, setFocus] = useState<PdfFocus | null>(null);
  const [diagram, setDiagram] = useState<{ code: string; title: string } | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const chatPanel = useRef<ChatPanelHandle>(null);
  const canvasSource = sources.find((s) => s.id === canvasSourceId) ?? null;

  const ready = sources.filter((s) => s.stage === "ready");
  const included = ready.filter((s) => s.included);
  const blocked =
    sources.length === 0
      ? "Add a source to start asking questions about it."
      : ready.length === 0
        ? "Your sources are still being read. You can ask as soon as one is ready."
        : included.length === 0
          ? "Every source is switched off. Tick one in Sources to ask about it."
          : null;
  const titleOf = useCallback(
    (id: string) => sources.find((s) => s.id === id)?.original_filename ?? "Source",
    [sources],
  );

  const showCanvas = (tab: CanvasTab) => {
    setCanvasTab(tab);
    setCanvasOpen(true);
    if (!isWide) setMobilePane("canvas");
  };

  const openSource = (id: string) => {
    setSelectedId(id);
    setCanvasSourceId(id);
    setFocus(null);
    showCanvas("source");
  };

  const onOpenCitation = useCallback(
    (c: Citation) => {
      setCanvasSourceId(c.document_id);
      setFocus({ page: c.page_start ?? 1, boxes: c.bboxes, key: Date.now() });
      setCanvasTab("source");
      setCanvasOpen(true);
      if (!isWide) setMobilePane("canvas");
    },
    [isWide],
  );

  const onOpenDiagram = useCallback(
    (code: string, title: string) => {
      setDiagram({ code, title });
      setCanvasTab("diagram");
      setCanvasOpen(true);
      if (!isWide) setMobilePane("canvas");
    },
    [isWide],
  );

  const quote = (source: Source, sel: PdfSelection): Attachment => ({
    document_id: source.id,
    page: sel.page,
    text: sel.text,
  });

  const onToggleIncluded = async (source: Source, value: boolean) => {
    setSources((list) => list.map((s) => (s.id === source.id ? { ...s, included: value } : s)));
    const res = await setSourceIncluded(undefined as never, { documentId: source.id, included: value });
    if (!res?.ok) {
      setSources((list) => list.map((s) => (s.id === source.id ? { ...s, included: !value } : s)));
      toast.error("Couldn't change that source");
    }
  };

  const sourcesPane = (
    <div className="h-full overflow-y-auto p-4">
      <SourcesPanel
        sources={sources}
        uploads={uploads}
        selectedId={selectedId}
        connection={connection}
        {...handlers}
        onSelect={(id) => openSource(id)}
        onToggleIncluded={(s, v) => void onToggleIncluded(s, v)}
      />
    </div>
  );

  const chatPane = (
    <ChatPanel
      ref={chatPanel}
      notebookId={notebook.id}
      initialChats={initialChats}
      initialChatId={initialChatId}
      initialMessages={initialMessages}
      defaultLevel={defaultLevel}
      sources={ready.map((s) => ({ id: s.id, title: s.original_filename }))}
      asking={{ k: included.length, n: ready.length }}
      blocked={blocked}
      attachments={attachments}
      onAttachmentsChange={setAttachments}
      attachmentTitle={titleOf}
      onOpenCitation={onOpenCitation}
      onOpenDiagram={onOpenDiagram}
    />
  );

  const canvasPane = (
    <Canvas
      tab={canvasTab}
      onTab={setCanvasTab}
      source={canvasSource}
      focus={focus}
      diagram={diagram}
      onClose={() => {
        setCanvasOpen(false);
        if (!isWide) setMobilePane("chat");
      }}
      onReprocess={handlers.onReprocess}
      onAsk={(source, sel) => {
        setAttachments((a) => [...a, quote(source, sel)].slice(-3));
        if (!isWide) setMobilePane("chat");
        requestAnimationFrame(() => chatPanel.current?.focus());
      }}
      onExplain={(source, sel) => {
        if (!isWide) setMobilePane("chat");
        chatPanel.current?.ask({
          message: "Explain this passage.",
          command: "explain",
          attachments: [quote(source, sel)],
        });
      }}
      onSaveNote={async (source, sel) => {
        const res = await createNote(undefined as never, {
          notebookId: notebook.id,
          documentId: source.id,
          page: sel.page,
          quote: sel.text,
        });
        if (res?.ok) toast.success("Saved to notes");
        else toast.error("Couldn't save the note");
      }}
    />
  );

  const separator =
    "w-px bg-rule outline-none transition-colors hover:bg-rule-strong focus-visible:bg-ink data-[separator=active]:bg-ink";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-rule px-4 py-2">
        <ColorDot color={notebook.color} className="size-3 shrink-0" />
        <h1 className="min-w-0 truncate text-h3 text-ink">{notebook.title}</h1>
        <div className="hidden min-w-0 items-center gap-x-3 text-small text-graphite md:flex">
          <StatusWord status={notebook.status} />
          {notebook.subject && <span className="truncate">{notebook.subject}</span>}
          {notebook.exam_date && <span>Exam {formatExamDate(notebook.exam_date)}</span>}
        </div>
      </div>

      {isWide ? (
        <Group orientation="horizontal" id={`notebook-${notebook.id}`} className="min-h-0 flex-1">
          <Panel id="sources" defaultSize={288} minSize={220} maxSize={440} collapsible collapsedSize={0}>
            {sourcesPane}
          </Panel>
          <Separator className={separator} />
          <Panel id="chat" minSize={380}>
            {chatPane}
          </Panel>
          {canvasOpen && (
            <>
              <Separator className={separator} />
              <Panel id="canvas" defaultSize="42%" minSize={340}>
                {canvasPane}
              </Panel>
            </>
          )}
        </Group>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div role="tablist" aria-label="Notebook" className="flex shrink-0 border-b border-rule px-2">
            {(
              [
                ["sources", `Sources${sources.length ? ` ${sources.length}` : ""}`],
                ["chat", "Chat"],
                ["canvas", canvasTab === "diagram" ? "Diagram" : "Source"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mobilePane === id}
                disabled={id === "canvas" && !canvasOpen}
                onClick={() => setMobilePane(id)}
                className={cn(
                  "interactive -mb-px h-10 border-b-2 px-3 text-small disabled:opacity-40",
                  mobilePane === id
                    ? "border-primary font-medium text-ink"
                    : "border-transparent text-graphite",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {mobilePane === "sources"
              ? sourcesPane
              : mobilePane === "canvas" && canvasOpen
                ? canvasPane
                : chatPane}
          </div>
        </div>
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        notebookId={notebook.id}
        sources={sources}
        onAdd={addFiles}
        onOpenSource={(id) => openSource(id)}
      />
      <WindowDropZone onFiles={addFiles} disabled={uploadOpen} />
    </div>
  );
}

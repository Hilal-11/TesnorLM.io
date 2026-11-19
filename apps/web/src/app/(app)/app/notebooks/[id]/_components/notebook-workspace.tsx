"use client";

import { FileSearch } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { backgroundTitle } from "@/lib/documents/live";
import { isPdfName, type Source } from "@/lib/documents/shared";
import type { Notebook } from "@/lib/notebooks/shared";
import { getUploadManager, useUploads } from "@/lib/uploads/browser";
import { MAX_FILES } from "@/lib/uploads/manager";
import { PageHeader } from "../../../_components/page-header";
import { touchNotebook } from "../../actions";
import { ColorDot, StatusWord, formatExamDate } from "../../_components/notebook-visuals";
import { SourceDetail } from "./source-detail";
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

/** A notebook: the Sources panel (272px) and the selected source. Phase 4 adds the conversation. */
export function NotebookWorkspace({
  notebook,
  initialSources,
}: {
  notebook: Notebook;
  initialSources: Source[];
}) {
  const { sources, setSources, connection } = useLiveSources(notebook.id, initialSources);
  const { items } = useUploads();
  const uploads = items.filter((i) => i.notebookId === notebook.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const params = useSearchParams();
  const [uploadOpen, setUploadOpen] = useState(() => params.get("add") === "1");
  const selected = sources.find((s) => s.id === selectedId) ?? null;

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <ColorDot color={notebook.color} className="size-3" />
            {notebook.title}
          </span>
        }
        description={notebook.description ?? undefined}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-graphite">
        <StatusWord status={notebook.status} />
        {notebook.subject && <span>{notebook.subject}</span>}
        {notebook.exam_date && <span>Exam {formatExamDate(notebook.exam_date)}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[272px_minmax(0,1fr)]">
        <SourcesPanel
          sources={sources}
          uploads={uploads}
          selectedId={selectedId}
          connection={connection}
          {...handlers}
        />
        <div className="min-w-0">
          {selected ? (
            <SourceDetail source={selected} onReprocess={handlers.onReprocess} />
          ) : sources.length > 0 ? (
            <div className="rounded-md border border-rule">
              <EmptyState
                titleAs="h2"
                icon={FileSearch}
                title="Select a source"
                description="See its pages, figures and how reading it went. Asking questions arrives next."
              />
            </div>
          ) : null}
        </div>
      </div>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        notebookId={notebook.id}
        sources={sources}
        onAdd={addFiles}
        onOpenSource={(id) => setSelectedId(id)}
      />
      <WindowDropZone onFiles={addFiles} disabled={uploadOpen} />
    </div>
  );
}

"use client";

import { LayoutGrid, List, NotebookPen, Plus, SearchX, SquareKanban } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePersistentState } from "@/hooks/use-persistent-state";
import {
  NOTEBOOK_SORTS,
  NOTEBOOK_STATUSES,
  SORT_LABELS,
  STATUS_LABELS,
  filterNotebooks,
  sortNotebooks,
  type Notebook,
  type NotebookSort,
  type NotebookStatus,
  type NotebookWithCounts,
} from "@/lib/notebooks/shared";
import { PageHeader } from "../../_components/page-header";
import { NotebookCard } from "./notebook-card";
import { NotebookDialog } from "./notebook-dialog";
import type { NotebookMenuHandlers } from "./notebook-menu";
import { NotebooksBoard } from "./notebooks-board";
import { NotebooksTable } from "./notebooks-table";
import { useNotebookList } from "./use-notebooks";

const VIEWS = ["grid", "list", "board"] as const;
type View = (typeof VIEWS)[number];
const VIEW_OPTIONS = [
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "list", label: "List", icon: List },
  { value: "board", label: "Board", icon: SquareKanban },
];
const ALL = "all";

type DialogState =
  | { open: false }
  | {
      open: true;
      notebook?: Notebook;
      status?: NotebookStatus;
      focus?: "exam_date";
      stay?: boolean;
    };

/** Debounced copy of a value (search filters 150 ms after typing stops). */
function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function NotebooksView({ initialNotebooks }: { initialNotebooks: NotebookWithCounts[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { list, merge, update, move, remove } = useNotebookList(initialNotebooks);

  // View: the URL wins (shareable), else the last choice in this browser, else grid.
  const [storedView, setStoredView] = usePersistentState<View>("tensorlm:notebooks-view", "grid");
  const urlView = params.get("view");
  const view: View = VIEWS.includes(urlView as View) ? (urlView as View) : storedView;
  const setView = (next: string) => {
    setStoredView(next as View);
    const query = new URLSearchParams(params);
    query.set("view", next);
    router.replace(`${pathname}?${query}`, { scroll: false });
  };

  const [query, setQuery] = useState("");
  const q = useDebounced(query, 150);
  const [status, setStatus] = useState<string>(ALL);
  const [subject, setSubject] = useState<string>(ALL);
  const [sort, setSort] = useState<NotebookSort>("last_opened");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ open: false });

  // ?new=1 (from Home) opens "New notebook" once, then leaves the URL clean.
  const wantsNew = params.get("new") === "1";
  const [handledNew, setHandledNew] = useState(false);
  if (wantsNew !== handledNew) {
    setHandledNew(wantsNew);
    if (wantsNew) setDialog({ open: true });
  }
  useEffect(() => {
    if (!wantsNew) return;
    const query = new URLSearchParams(params);
    query.delete("new");
    router.replace(query.size ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [wantsNew, params, pathname, router]);

  const subjects = useMemo(
    () => [...new Set(list.map((n) => n.subject).filter((s): s is string => Boolean(s)))].sort(),
    [list],
  );
  const visible = useMemo(
    () =>
      sortNotebooks(
        filterNotebooks(list, {
          q,
          status: status === ALL ? undefined : (status as NotebookStatus),
          subject: subject === ALL ? undefined : subject,
        }),
        sort,
      ),
    [list, q, status, subject, sort],
  );
  const filtering = q.trim() !== "" || status !== ALL || subject !== ALL;
  const clearFilters = () => {
    setQuery("");
    setStatus(ALL);
    setSubject(ALL);
  };

  const handlers: NotebookMenuHandlers = useMemo(
    () => ({
      // Inline on cards; the list view edits the name in the dialog.
      onRename: (n) =>
        view === "list" ? setDialog({ open: true, notebook: n }) : setRenamingId(n.id),
      onEdit: (n, focus) => setDialog({ open: true, notebook: n, focus }),
      onColor: (n, color) => void update(n, { color }),
      onMove: (n, next) => void move(n, next),
      onDelete: (n) => void remove([n.id]),
    }),
    [view, update, move, remove],
  );

  const onRenameDone = useCallback(
    (n: Notebook, title: string | null) => {
      setRenamingId(null);
      if (title) void update(n, { title });
    },
    [update],
  );

  const onSaved = (notebook: Notebook) => {
    merge([notebook]);
    if (dialog.open && !dialog.notebook && !dialog.stay)
      router.push(`/app/notebooks/${notebook.id}`);
  };

  const newButton = (
    <Button leadingIcon={Plus} onClick={() => setDialog({ open: true })}>
      New notebook
    </Button>
  );

  const firstNotebook = (
    <div className="rounded-md border border-rule">
      <EmptyState
        graphPaper
        titleAs="h2"
        icon={NotebookPen}
        title="Create your first notebook"
        description="Add a paper, notes or a dataset, then ask anything about it."
        action={{ label: "New notebook", icon: Plus, onClick: () => setDialog({ open: true }) }}
      />
    </div>
  );
  const noResults = (
    <EmptyState
      titleAs="h2"
      icon={SearchX}
      title={q.trim() ? `No notebooks match “${q.trim()}”` : "No notebooks match these filters"}
      description="Try a different word, or clear the search and filters."
      action={{ label: "Clear search", onClick: clearFilters }}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notebooks"
        description="Group sources by course, topic or exam."
        action={newButton}
      />

      {list.length === 0 ? (
        firstNotebook
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search notebooks"
              aria-label="Search notebooks"
              shortcut={[]}
              className="lg:max-w-72 lg:flex-1"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger aria-label="Status" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {NOTEBOOK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger aria-label="Subject" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All subjects</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {view !== "board" && (
                <Select value={sort} onValueChange={(v) => setSort(v as NotebookSort)}>
                  <SelectTrigger aria-label="Sort by" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTEBOOK_SORTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SORT_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <SegmentedControl
              aria-label="View"
              options={VIEW_OPTIONS}
              value={view}
              onValueChange={setView}
              className="lg:ml-auto"
            />
          </div>

          <p className="sr-only" aria-live="polite">
            {filtering ? `${visible.length} of ${list.length} notebooks shown` : ""}
          </p>

          {view === "list" ? (
            <NotebooksTable
              notebooks={visible}
              emptyState={noResults}
              onBulkMove={(ids, next) => {
                for (const n of list.filter((x) => ids.includes(x.id))) void move(n, next);
              }}
              onBulkDelete={(ids) => void remove(ids)}
              {...handlers}
            />
          ) : visible.length === 0 ? (
            noResults
          ) : view === "board" ? (
            <NotebooksBoard
              notebooks={visible}
              onAdd={(s) => setDialog({ open: true, status: s, stay: true })}
              renamingId={renamingId}
              onRenameDone={onRenameDone}
              {...handlers}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 min-[1440px]:grid-cols-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((n) => (
                <li key={n.id} className="flex">
                  <NotebookCard
                    notebook={n}
                    renaming={renamingId === n.id}
                    onRenameDone={(title) => onRenameDone(n, title)}
                    className="w-full"
                    {...handlers}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <NotebookDialog
        open={dialog.open}
        onOpenChange={(open) => !open && setDialog({ open: false })}
        notebook={dialog.open ? dialog.notebook : undefined}
        status={dialog.open ? dialog.status : undefined}
        focus={dialog.open ? dialog.focus : undefined}
        onSaved={onSaved}
      />
    </div>
  );
}

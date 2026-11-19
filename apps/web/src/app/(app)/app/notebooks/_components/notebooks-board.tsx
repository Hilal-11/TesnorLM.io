"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  boardIds,
  columnId,
  dropChanged,
  findColumn,
  moveAcross,
  neighboursOf,
  placeOf,
  reorderWithin,
  type BoardIds,
} from "@/lib/notebooks/board";
import {
  NOTEBOOK_STATUSES,
  STATUS_LABELS,
  type Notebook,
  type NotebookStatus,
  type NotebookWithCounts,
} from "@/lib/notebooks/shared";
import { cn } from "@/lib/utils";
import { NotebookCard } from "./notebook-card";
import type { NotebookMenuHandlers } from "./notebook-menu";
import { STATUS_ICONS } from "./notebook-visuals";

type NotebooksBoardProps = NotebookMenuHandlers & {
  notebooks: NotebookWithCounts[];
  onAdd: (status: NotebookStatus) => void;
  /** A drop: the card's new column and the cards it now sits between. */
  onReorder: (
    notebook: Notebook,
    status: NotebookStatus,
    beforeId: string | null,
    afterId: string | null,
  ) => void;
  renamingId?: string | null;
  onRenameDone?: (notebook: Notebook, title: string | null) => void;
};

const INSTRUCTIONS =
  "To move a notebook, focus its move handle and press Space. Use the arrow keys to move it, Space to drop it, or Escape to cancel.";

/**
 * Board: To read · Learning · Reviewing · Mastered, in position order, with drag and drop by
 * mouse, touch (long press, so the page still scrolls) and keyboard (Space, arrows, Space).
 *
 * Mobile (< 768 px): the four columns stack vertically instead of scrolling sideways, so nothing
 * overflows at 320 px and every card stays visible; a long press (250 ms) starts a drag so a swipe
 * still scrolls the page. "Move to…" in the card menu is the quick path on small screens.
 */
export function NotebooksBoard({
  notebooks,
  onAdd,
  onReorder,
  renamingId,
  onRenameDone,
  ...handlers
}: NotebooksBoardProps) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const byId = useMemo(() => new Map(notebooks.map((n) => [n.id, n])), [notebooks]);
  const fromProps = useMemo(() => boardIds(notebooks), [notebooks]);

  // While dragging, the board shows its own copy (cards move between columns as you hover).
  const [dragIds, setDragIds] = useState<BoardIds | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const startIds = useRef<BoardIds | null>(null);
  const justDropped = useRef(false);
  const ids = dragIds ?? fromProps;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const title = (id: UniqueIdentifier) => byId.get(String(id))?.title ?? "Notebook";
  // Where the card will be once this event is applied (dnd-kit announces before React renders).
  const where = (id: UniqueIdentifier, over: UniqueIdentifier | null) => {
    const a = String(id);
    const projected = over ? reorderWithin(moveAcross(ids, a, String(over)), a, String(over)) : ids;
    const place = placeOf(projected, a);
    return place
      ? `${STATUS_LABELS[place.status]}, position ${place.position} of ${place.total}`
      : "";
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${title(active.id)}. ${where(active.id, null)}.`,
    // Over its own slot (right after pickup) there's nothing new to say.
    onDragOver: ({ active, over }) =>
      over && over.id !== active.id
        ? `${title(active.id)} is in ${where(active.id, over.id)}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${title(active.id)} dropped in ${where(active.id, over.id)}.`
        : `${title(active.id)} wasn't moved.`,
    onDragCancel: ({ active }) => `Move cancelled. ${title(active.id)} is back where it was.`,
  };

  function onDragStart({ active }: DragStartEvent) {
    startIds.current = fromProps;
    setDragIds(fromProps);
    setActiveId(String(active.id));
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    setDragIds((current) => moveAcross(current ?? fromProps, String(active.id), String(over.id)));
  }

  function finish() {
    setDragIds(null);
    setActiveId(null);
    startIds.current = null;
    justDropped.current = true;
    setTimeout(() => (justDropped.current = false), 0);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    const before = startIds.current ?? fromProps;
    const notebook = byId.get(id);
    if (over && notebook) {
      const after = reorderWithin(ids, id, String(over.id));
      const landing = neighboursOf(after, id);
      if (landing && dropChanged(before, after, id)) {
        onReorder(notebook, landing.status, landing.beforeId, landing.afterId);
      }
    }
    finish();
  }

  const active = activeId ? byId.get(activeId) : undefined;
  const overColumn = activeId ? findColumn(ids, activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={finish}
      accessibility={{ announcements, screenReaderInstructions: { draggable: INSTRUCTIONS } }}
    >
      <div
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        onClickCapture={(e) => {
          // A drop that ends over a card link must not open it.
          if (justDropped.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {NOTEBOOK_STATUSES.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            count={ids[status].length}
            highlighted={Boolean(activeId) && overColumn === status}
            onAdd={() => onAdd(status)}
          >
            <SortableContext items={ids[status]} strategy={verticalListSortingStrategy}>
              {ids[status].length > 0 ? (
                <ol className="flex flex-col gap-2">
                  {ids[status].map((id) => {
                    const n = byId.get(id);
                    if (!n) return null;
                    return (
                      <SortableCard key={id} notebook={n} reducedMotion={reducedMotion}>
                        {(handle) => (
                          <NotebookCard
                            notebook={n}
                            compact
                            dragHandle={handle}
                            renaming={renamingId === n.id}
                            onRenameDone={(t) => onRenameDone?.(n, t)}
                            {...handlers}
                          />
                        )}
                      </SortableCard>
                    );
                  })}
                </ol>
              ) : (
                <p className="px-1 text-small text-graphite">Drag notebooks here</p>
              )}
            </SortableContext>
          </BoardColumn>
        ))}
      </div>

      {/* The lifted card: a bigger shadow, never a tilt (skill 7.3). */}
      <DragOverlay dropAnimation={reducedMotion ? null : { duration: 220 }}>
        {active ? (
          <div aria-hidden inert className="cursor-grabbing">
            <NotebookCard
              notebook={active}
              compact
              dragHandle={<GripVertical aria-hidden className="size-3.5 text-graphite" />}
              className="shadow-3 hover:translate-y-0"
              {...handlers}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  status,
  count,
  highlighted,
  onAdd,
  children,
}: {
  status: NotebookStatus;
  count: number;
  highlighted: boolean;
  onAdd: () => void;
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: columnId(status) });
  const Icon = STATUS_ICONS[status];
  const headingId = `board-${status}`;
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      data-highlighted={highlighted || undefined}
      className={cn(
        "flex min-h-40 flex-col gap-3 rounded-md border border-rule bg-subtle p-3",
        "transition-colors duration-(--dur-fast) ease-out motion-reduce:transition-none",
        "data-highlighted:border-primary data-highlighted:bg-accent",
      )}
    >
      <header className="flex items-center gap-2 px-1">
        <Icon aria-hidden className="size-4 text-graphite" />
        <h2 id={headingId} className="text-h3 text-ink">
          {STATUS_LABELS[status]}
        </h2>
        <Badge aria-label={`${count} ${count === 1 ? "notebook" : "notebooks"}`}>{count}</Badge>
      </header>
      {children}
      <Button
        variant="ghost"
        size="sm"
        leadingIcon={Plus}
        className="mt-auto justify-start text-graphite"
        onClick={onAdd}
      >
        Add notebook
      </Button>
    </section>
  );
}

function SortableCard({
  notebook,
  reducedMotion,
  children,
}: {
  notebook: Notebook;
  reducedMotion: boolean;
  children: (handle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: notebook.id, transition: reducedMotion ? null : undefined });

  // Listeners sit on the whole card, so mouse and touch drag from anywhere on it. The keyboard
  // sensor only starts when the key event's target is the activator (the handle), so Enter on the
  // title link still opens the notebook.
  const handle = (
    <IconButton
      ref={setActivatorNodeRef}
      icon={GripVertical}
      aria-label={`Move ${notebook.title}`}
      tooltip={false}
      size="sm"
      className="relative z-10 cursor-grab touch-none text-graphite"
      {...attributes}
    />
  );

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition: transition ?? undefined }}
      className={cn(
        "rounded-md",
        // The gap left behind is a dashed placeholder.
        isDragging && "border border-dashed border-rule-strong *:invisible",
      )}
      {...listeners}
    >
      {children(handle)}
    </li>
  );
}

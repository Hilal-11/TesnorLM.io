/**
 * Pure board logic for drag and drop: which column a card is in, moving it across columns while
 * it's dragged, and the neighbours it lands between (what `moveNotebook` needs).
 */
import { NOTEBOOK_STATUSES, boardColumns, type Notebook, type NotebookStatus } from "./shared";

export type BoardIds = Record<NotebookStatus, string[]>;

export const COLUMN_PREFIX = "column:";
export const columnId = (status: NotebookStatus) => `${COLUMN_PREFIX}${status}`;

function asStatus(id: string): NotebookStatus | undefined {
  if (!id.startsWith(COLUMN_PREFIX)) return undefined;
  const status = id.slice(COLUMN_PREFIX.length);
  return (NOTEBOOK_STATUSES as readonly string[]).includes(status)
    ? (status as NotebookStatus)
    : undefined;
}

/** Card ids per column, in board order. */
export function boardIds(list: Notebook[]): BoardIds {
  const columns = boardColumns(list);
  return Object.fromEntries(
    NOTEBOOK_STATUSES.map((s) => [s, (columns.get(s) ?? []).map((n) => n.id)]),
  ) as BoardIds;
}

/** The column a card or a column droppable belongs to. */
export function findColumn(ids: BoardIds, id: string): NotebookStatus | undefined {
  return asStatus(id) ?? NOTEBOOK_STATUSES.find((s) => ids[s].includes(id));
}

/**
 * While dragging over another column: take the card out of its column and put it where the
 * pointer is (before the card it's over, or at the end when it's over the column itself).
 * Returns the same object when nothing changes, so React can skip a render.
 */
export function moveAcross(ids: BoardIds, activeId: string, overId: string): BoardIds {
  const from = findColumn(ids, activeId);
  const to = findColumn(ids, overId);
  if (!from || !to || from === to) return ids;
  const target = ids[to].filter((id) => id !== activeId);
  const overIndex = target.indexOf(overId);
  const index = overIndex === -1 ? target.length : overIndex;
  return {
    ...ids,
    [from]: ids[from].filter((id) => id !== activeId),
    [to]: [...target.slice(0, index), activeId, ...target.slice(index)],
  };
}

/** On drop within one column: move the card to the slot of the card it's over. */
export function reorderWithin(ids: BoardIds, activeId: string, overId: string): BoardIds {
  const column = findColumn(ids, activeId);
  if (!column || findColumn(ids, overId) !== column) return ids;
  const list = ids[column];
  const from = list.indexOf(activeId);
  const to = asStatus(overId) ? list.length - 1 : list.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return ids;
  const next = [...list];
  next.splice(from, 1);
  next.splice(to, 0, activeId);
  return { ...ids, [column]: next };
}

/** Where a card sits: its column, 1-based position and the column's size (announcements). */
export function placeOf(ids: BoardIds, id: string) {
  const status = findColumn(ids, id);
  if (!status) return undefined;
  return { status, position: ids[status].indexOf(id) + 1, total: ids[status].length };
}

/** The cards just above (`beforeId`) and below (`afterId`) a card in its column. */
export function neighboursOf(ids: BoardIds, id: string) {
  const status = findColumn(ids, id);
  if (!status) return undefined;
  const list = ids[status];
  const index = list.indexOf(id);
  return {
    status,
    beforeId: index > 0 ? list[index - 1] : null,
    afterId: index < list.length - 1 ? list[index + 1] : null,
  };
}

/** Whether a drop changed the card's column or neighbours (no change = no request). */
export function dropChanged(before: BoardIds, after: BoardIds, id: string) {
  const a = neighboursOf(before, id);
  const b = neighboursOf(after, id);
  return !a || !b || a.status !== b.status || a.beforeId !== b.beforeId || a.afterId !== b.afterId;
}

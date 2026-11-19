"use client";

import { useCallback, useState } from "react";
import { toast } from "@/components/ui/toast";
import {
  positionBetween,
  type Notebook,
  type NotebookPatch,
  type NotebookStatus,
  type NotebookWithCounts,
} from "@/lib/notebooks/shared";
import { deleteNotebooks, moveNotebook, restoreNotebooks, updateNotebook } from "../actions";

/** A server action call that never throws: a network failure reads as "no answer" (null). */
async function call<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

/**
 * The notebooks page's list: server data in, optimistic changes on top, rolled back with a toast
 * that says what failed when the server refuses. A fresh server render replaces it.
 */
export function useNotebookList(initial: NotebookWithCounts[]) {
  const [list, setList] = useState(initial);
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setList(initial);
  }

  const merge = useCallback((rows: Notebook[]) => {
    setList((current) => {
      const byId = new Map(current.map((n) => [n.id, n]));
      for (const row of rows) byId.set(row.id, { source_count: 0, ...byId.get(row.id), ...row });
      return [...byId.values()];
    });
  }, []);

  const update = useCallback(
    async (notebook: Notebook, patch: NotebookPatch) => {
      const before = list.find((n) => n.id === notebook.id);
      merge([{ ...notebook, ...patch } as Notebook]);
      const res = await call(
        updateNotebook(null, {
          id: notebook.id,
          updatedAt: notebook.updated_at,
          patch,
        }),
      );
      if (res?.ok && res.data) return (merge([res.data]), true);
      if (res && !res.ok && res.code === "conflict" && res.data) merge([res.data]);
      else if (before) merge([before]);
      toast.error(`Couldn't save "${notebook.title}"`, {
        description: res && !res.ok ? res.error : "Try again in a moment.",
      });
      return false;
    },
    [list, merge],
  );

  const move = useCallback(
    async (
      notebook: Notebook,
      status: NotebookStatus,
      beforeId: string | null = null,
      afterId: string | null = null,
    ) => {
      const before = list.find((n) => n.id === notebook.id);
      const lower = list.find((n) => n.id === beforeId)?.position ?? null;
      const upper = list.find((n) => n.id === afterId)?.position ?? null;
      const last = list
        .filter((n) => n.status === status && n.id !== notebook.id)
        .map((n) => n.position)
        .sort()
        .at(-1);
      const position =
        lower === null && upper === null
          ? positionBetween(last ?? null, null)
          : positionBetween(lower, upper);
      merge([{ ...notebook, status, position }]);
      const res = await call(moveNotebook(null, { id: notebook.id, status, beforeId, afterId }));
      if (res?.ok && res.data) return (merge([res.data]), true);
      if (before) merge([before]);
      toast.error(`Couldn't move "${notebook.title}". Try again.`, {
        description: res && !res.ok ? res.error : undefined,
      });
      return false;
    },
    [list, merge],
  );

  const restore = useCallback(
    async (ids: string[]) => {
      const res = await call(restoreNotebooks(null, { ids }));
      if (res?.ok && res.data) merge(res.data);
      else toast.error("Couldn't restore", { description: res && !res.ok ? res.error : undefined });
    },
    [merge],
  );

  /** Soft delete with Undo (8 s), no confirmation dialog (skill 8.4). */
  const remove = useCallback(
    async (ids: string[]) => {
      const removed = list.filter((n) => ids.includes(n.id));
      setList((current) => current.filter((n) => !ids.includes(n.id)));
      const res = await call(deleteNotebooks(null, { ids }));
      if (res?.ok) {
        toast.success(res.message ?? "Notebook deleted", {
          action: { label: "Undo", onClick: () => void restore(ids) },
        });
        return true;
      }
      merge(removed);
      toast.error("Couldn't delete", { description: res && !res.ok ? res.error : undefined });
      return false;
    },
    [list, merge, restore],
  );

  return { list, merge, update, move, remove, restore };
}

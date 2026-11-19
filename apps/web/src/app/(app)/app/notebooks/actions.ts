"use server";

import { revalidatePath } from "next/cache";
import { requireUserForApi } from "@/lib/auth";
import { defineAction } from "@/lib/errors";
import { sendEvent } from "@/lib/events";
import * as repo from "@/lib/notebooks/repo";
import {
  notebookCreateSchema,
  notebookIdSchema,
  notebookIdsSchema,
  notebookMoveSchema,
  notebookUpdateSchema,
  type Notebook,
} from "@/lib/notebooks/shared";
import { createClient } from "@/lib/supabase/server";

/** The sidebar's recent notebooks render on the server, so changes refresh the app layout. */
const refresh = () => revalidatePath("/app", "layout");

export const createNotebook = defineAction(notebookCreateSchema, async (input) => {
  const user = await requireUserForApi();
  const notebook = await repo.createNotebook(await createClient(), user.id, input);
  refresh();
  return { ok: true, data: notebook, message: "Notebook created" };
});

export const updateNotebook = defineAction(
  notebookUpdateSchema,
  async ({ id, updatedAt, patch }) => {
    await requireUserForApi();
    try {
      const notebook = await repo.updateNotebook(await createClient(), id, patch, updatedAt);
      refresh();
      return { ok: true, data: notebook, message: "Changes saved" };
    } catch (err) {
      if (!(err instanceof repo.NotebookConflict)) throw err;
      return {
        ok: false,
        code: "conflict",
        error: "This notebook changed in another tab. We've loaded the latest version.",
        data: err.fresh,
      };
    }
  },
);

export const moveNotebook = defineAction(notebookMoveSchema, async (move) => {
  await requireUserForApi();
  const notebook = await repo.moveNotebook(await createClient(), move);
  refresh();
  return { ok: true, data: notebook };
});

export const touchNotebook = defineAction(notebookIdSchema, async ({ id }) => {
  await requireUserForApi();
  await repo.touchNotebook(await createClient(), id);
  refresh();
  return { ok: true };
});

/** Soft delete: hidden at once; the cleanup job removes it after the Undo window. */
export const deleteNotebooks = defineAction(notebookIdsSchema, async ({ ids }) => {
  const user = await requireUserForApi();
  const db = await createClient();
  const deleted: Notebook[] = [];
  for (const id of ids) {
    const notebook = await repo.softDeleteNotebook(db, id);
    deleted.push(notebook);
    await sendEvent("notebookDeleted", { notebook_id: notebook.id, user_id: user.id });
  }
  refresh();
  return {
    ok: true,
    data: deleted,
    message: deleted.length === 1 ? "Notebook deleted" : `${deleted.length} notebooks deleted`,
  };
});

export const restoreNotebooks = defineAction(notebookIdsSchema, async ({ ids }) => {
  await requireUserForApi();
  const db = await createClient();
  const restored: Notebook[] = [];
  for (const id of ids) restored.push(await repo.restoreNotebook(db, id));
  refresh();
  return { ok: true, data: restored };
});

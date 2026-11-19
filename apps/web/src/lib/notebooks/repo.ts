/**
 * Notebook data access. Every function takes the caller's Supabase client, so RLS decides what a
 * person can see and change; server actions are thin wrappers, and tests/rls call these directly
 * as two different people.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { notFound } from "@/lib/errors";
import {
  compareBoardOrder,
  filterNotebooks,
  positionBetween,
  sortNotebooks,
  type Notebook,
  type NotebookCreate,
  type NotebookFilters,
  type NotebookMove,
  type NotebookPatch,
  type NotebookWithCounts,
} from "./shared";

export type Db = SupabaseClient<Database>;

/** Someone (another tab, another device) changed the notebook since it was loaded. */
export class NotebookConflict extends Error {
  constructor(public fresh: Notebook) {
    super("conflict");
  }
}

type RowWithCount = Notebook & { documents: { count: number }[] | null };

function withCounts(rows: RowWithCount[]): NotebookWithCounts[] {
  return rows.map(({ documents, ...n }) => ({ ...n, source_count: documents?.[0]?.count ?? 0 }));
}

/** The person's live notebooks with live source counts, filtered and sorted. */
export async function listNotebooks(
  db: Db,
  filters: NotebookFilters = {},
): Promise<NotebookWithCounts[]> {
  const { data, error } = await db
    .from("notebooks")
    .select("*, documents(count)")
    .is("deleted_at", null)
    .is("documents.deleted_at", null);
  if (error) throw error;
  const list = withCounts((data ?? []) as RowWithCount[]);
  return sortNotebooks(filterNotebooks(list, filters), filters.sort);
}

/** The most recently opened notebooks, for the sidebar. */
export async function recentNotebooks(db: Db, limit = 6) {
  const { data, error } = await db
    .from("notebooks")
    .select("id, title, color, last_opened_at, created_at")
    .is("deleted_at", null)
    .order("last_opened_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** One live notebook, or null when it doesn't exist, isn't theirs or is deleted (→ 404). */
export async function getNotebook(db: Db, id: string): Promise<Notebook | null> {
  const { data, error } = await db
    .from("notebooks")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function lastPosition(db: Db, status: Notebook["status"], exceptId?: string) {
  let query = db
    .from("notebooks")
    .select("position")
    .eq("status", status)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1);
  if (exceptId) query = query.neq("id", exceptId);
  const { data, error } = await query;
  if (error) throw error;
  return data?.[0]?.position ?? null;
}

/** New notebooks go to the end of their board column. */
export async function createNotebook(db: Db, userId: string, input: NotebookCreate) {
  const position = positionBetween(await lastPosition(db, input.status), null);
  const { data, error } = await db
    .from("notebooks")
    .insert({ ...input, user_id: userId, position })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Saves a patch only if nobody changed the notebook since `expectedUpdatedAt`; otherwise throws
 * NotebookConflict with the fresh row so the person can review it.
 */
export async function updateNotebook(
  db: Db,
  id: string,
  patch: NotebookPatch,
  expectedUpdatedAt: string,
) {
  const { data, error } = await db
    .from("notebooks")
    .update(patch)
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (data) return data;
  const fresh = await getNotebook(db, id);
  if (!fresh) throw notFound("We couldn't find that notebook.");
  throw new NotebookConflict(fresh);
}

/** Moves a card to a column, between two neighbours (or to the end when there are none). */
export async function moveNotebook(db: Db, move: NotebookMove) {
  const neighbourIds = [move.beforeId, move.afterId].filter((v): v is string => Boolean(v));
  const neighbours = new Map<string, Pick<Notebook, "position" | "status">>();
  if (neighbourIds.length > 0) {
    const { data, error } = await db
      .from("notebooks")
      .select("id, position, status")
      .in("id", neighbourIds)
      .is("deleted_at", null);
    if (error) throw error;
    for (const n of data ?? []) if (n.status === move.status) neighbours.set(n.id, n);
  }
  const lower = (move.beforeId && neighbours.get(move.beforeId)?.position) || null;
  const upper = (move.afterId && neighbours.get(move.afterId)?.position) || null;
  const position =
    lower === null && upper === null
      ? positionBetween(await lastPosition(db, move.status, move.id), null)
      : positionBetween(lower, upper);

  const { data, error } = await db
    .from("notebooks")
    .update({ status: move.status, position })
    .eq("id", move.id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("We couldn't find that notebook.");
  return data;
}

/** Records that the person opened it (doesn't count as an edit). */
export async function touchNotebook(db: Db, id: string) {
  const { error } = await db
    .from("notebooks")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) throw error;
}

export async function softDeleteNotebook(db: Db, id: string) {
  const { data, error } = await db
    .from("notebooks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("We couldn't find that notebook.");
  return data;
}

export async function restoreNotebook(db: Db, id: string) {
  const { data, error } = await db
    .from("notebooks")
    .update({ deleted_at: null })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("That notebook can't be restored any more.");
  return data;
}

/** Board columns: each status's notebooks in position order. */
export function boardColumns<T extends Notebook>(list: T[]) {
  const columns = new Map<Notebook["status"], T[]>();
  for (const n of list) columns.set(n.status, [...(columns.get(n.status) ?? []), n]);
  for (const items of columns.values()) items.sort(compareBoardOrder);
  return columns;
}

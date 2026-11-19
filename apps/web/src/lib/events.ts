import "server-only";
import { inngest } from "@/inngest/client";
import { EVENTS } from "@/lib/ingestion/contract";
import { logger } from "@/lib/logger";

/** Payloads per event (spec section 12). Keys are snake_case, shared with the Python worker. */
export type EventData = {
  uploaded: { document_id: string; notebook_id: string; user_id: string; run_id: string };
  reprocess: { document_id: string; notebook_id: string; user_id: string; run_id: string };
  deleted: { document_id: string; notebook_id: string; user_id: string };
  notebookDeleted: { notebook_id: string; user_id: string };
};

/**
 * Sends a queue event. Returns false (and logs ids only) when the queue can't be reached, so
 * callers decide: an upload must report it; a delete carries on and the sweeper catches up.
 * `id` makes a send idempotent (the queue drops repeats with the same id).
 */
export async function sendEvent<K extends keyof EventData>(
  key: K,
  data: EventData[K],
  id?: string,
): Promise<boolean> {
  try {
    await inngest.send({ name: EVENTS[key], data, ...(id ? { id } : {}) });
    return true;
  } catch (err) {
    logger.warn("queue event not sent", {
      event: EVENTS[key],
      ...("document_id" in data ? { documentId: data.document_id } : {}),
      notebookId: data.notebook_id,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

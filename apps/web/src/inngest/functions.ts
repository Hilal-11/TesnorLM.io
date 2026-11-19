import "server-only";
import { inngest } from "@/inngest/client";
import { hardDeleteDocument, hardDeleteNotebook } from "@/lib/cleanup";
import { EVENTS } from "@/lib/ingestion/contract";
import { logger } from "@/lib/logger";
import { createAdmin } from "@/lib/supabase/admin";
import { sweepOrphans, sweepStaleUploads, sweepStuckRuns } from "@/lib/sweepers";

/** The Undo window (toast is 8 s; the spec waits 30 s before removing anything). */
export const UNDO_WINDOW = "30s";

/** After a source is deleted: wait out Undo, then remove its files and rows if still deleted. */
export const cleanupDocument = inngest.createFunction(
  { id: "cleanup-document", retries: 5, triggers: [{ event: EVENTS.deleted }] },
  async ({ event, step }) => {
    const { document_id: documentId } = event.data as { document_id: string };
    await step.sleep("undo-window", UNDO_WINDOW);
    const result = await step.run("hard-delete", () =>
      hardDeleteDocument(createAdmin(), documentId),
    );
    logger.info("document cleanup", { documentId, ...result });
    return result;
  },
);

/** After a notebook is deleted: same, for every document in it, then the notebook row. */
export const cleanupNotebook = inngest.createFunction(
  { id: "cleanup-notebook", retries: 5, triggers: [{ event: EVENTS.notebookDeleted }] },
  async ({ event, step }) => {
    const { notebook_id: notebookId } = event.data as { notebook_id: string };
    await step.sleep("undo-window", UNDO_WINDOW);
    const result = await step.run("hard-delete", () =>
      hardDeleteNotebook(createAdmin(), notebookId),
    );
    logger.info("notebook cleanup", { notebookId, ...result });
    return result;
  },
);

/** Every 30 min: uploads that never finished. */
export const staleUploadSweeper = inngest.createFunction(
  { id: "sweep-stale-uploads", triggers: [{ cron: "*/30 * * * *" }] },
  async ({ step }) => {
    const result = await step.run("sweep", () => sweepStaleUploads(createAdmin()));
    if (result.failed > 0) logger.info("stale uploads failed", result);
    return result;
  },
);

/** Daily: storage with no document row, and runs stuck for hours. */
export const orphanSweeper = inngest.createFunction(
  { id: "sweep-orphans", triggers: [{ cron: "15 3 * * *" }] },
  async ({ step }) => {
    const orphans = await step.run("orphans", () => sweepOrphans(createAdmin()));
    const stuck = await step.run("stuck-runs", () => sweepStuckRuns(createAdmin()));
    if (stuck.failed > 0) logger.warn("stuck ingest runs failed", { documentIds: stuck.ids });
    return { ...orphans, stuck: stuck.failed };
  },
);

export const functions = [cleanupDocument, cleanupNotebook, staleUploadSweeper, orphanSweeper];

import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

/**
 * The web app's queue functions (cleanup and sweepers). Inngest calls this endpoint; in
 * production every request must carry a valid signature (INNGEST_SIGNING_KEY), which the SDK
 * checks. The ingestion function itself lives in the worker (services/worker, /api/inngest).
 */
export const { GET, POST, PUT } = serve({ client: inngest, functions });

// Cleanup steps can take a while for big notebooks.
export const maxDuration = 300;

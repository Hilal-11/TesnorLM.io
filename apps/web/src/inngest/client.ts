import { Inngest } from "inngest";

/**
 * The queue client. Locally, INNGEST_DEV=1 sends to the Inngest Dev Server
 * (`npm run dev:inngest`); in production INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY are required.
 */
export const inngest = new Inngest({ id: "tensorlm" });

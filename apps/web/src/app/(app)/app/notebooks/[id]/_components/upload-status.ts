import { sourceStatus, type SourceStatus } from "@/lib/documents/live";
import type { Source } from "@/lib/documents/shared";
import { detailLine, errorCopy } from "@/lib/ingestion/contract";
import type { UploadItem } from "@/lib/uploads/manager";

/** Interface copy for the one upload state the contract doesn't name (spec section 16). */
export const WAITING_FOR_CONNECTION = "Waiting for connection…";

const percent = (item: UploadItem) =>
  item.size > 0 ? Math.min(100, Math.floor((item.sent / item.size) * 100)) : 0;

/** What an upload row (or a not-yet-saved source card) says, in the contract's words. */
export function uploadStatus(item: UploadItem, source?: Source): SourceStatus {
  if (source && item.phase === "done") return sourceStatus(source);
  switch (item.phase) {
    case "checking":
      return {
        pill: "uploading",
        word: "Uploading",
        line: detailLine("uploading"),
        progress: null,
      };
    case "waiting":
      return { pill: "queued", word: "Queued", line: detailLine("queued"), progress: null };
    case "reconnecting":
      return {
        pill: "uploading",
        word: "Uploading",
        line: WAITING_FOR_CONNECTION,
        progress: percent(item),
      };
    case "registering":
    case "uploading":
    case "confirming": {
      const p = item.phase === "confirming" ? 100 : percent(item);
      return {
        pill: "uploading",
        word: "Uploading",
        line: detailLine("uploading", { percent: p }),
        progress: p,
      };
    }
    case "done":
      return { pill: "queued", word: "Queued", line: detailLine("queued"), progress: null };
    case "failed": {
      const copy = errorCopy(item.error?.code, item.error?.vars ?? {});
      const known = copy.code === item.error?.code;
      return {
        pill: "failed",
        word: "Failed",
        line: known ? copy.message : (item.error?.message ?? copy.message),
        fix: known ? copy.fix : "Try again in a moment.",
        actions: known ? copy.actions : [{ id: "retry", label: "Try again" }],
        progress: null,
      };
    }
  }
}

/** Busy rows can be cancelled; finished or failed ones can be removed. */
export const isBusy = (item: UploadItem) => !["done", "failed"].includes(item.phase);

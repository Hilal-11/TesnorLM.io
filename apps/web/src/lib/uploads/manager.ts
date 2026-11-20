/**
 * Uploads in the browser (spec section 3, steps 1–4). One manager per tab, outside React, so
 * uploads keep running when the modal closes or the person moves between pages.
 *
 * Per file: pre-check (name/size at once; hash, header, pages, password in a Web Worker) →
 * register (POST /api/notebooks/:id/documents) → resumable TUS upload straight to Storage with
 * the person's session (6 MB chunks, real byte progress) → confirm (POST /api/documents/:id/uploaded).
 * At most 3 files upload at a time; the rest wait as "Queued". A dropped connection shows
 * "Waiting for connection…" and resumes from the last chunk when it's back.
 */
import { errorCopy, LIMITS, STORAGE } from "@/lib/ingestion/contract";
import { checkFile, checkScan, type Limits, type ScanResult } from "./precheck";

export type UploadPhase =
  | "checking"
  | "waiting"
  | "registering"
  | "uploading"
  | "reconnecting"
  | "confirming"
  | "done"
  | "failed";

export type UploadError = {
  code: string;
  vars?: Record<string, unknown>;
  /** duplicate_file: the copy already in the notebook ("Open it"). */
  existingId?: string;
  /** Server text for errors outside the contract (e.g. "Your session ended."). */
  message?: string;
};

export type UploadItem = {
  key: string;
  notebookId: string;
  name: string;
  size: number;
  phase: UploadPhase;
  /** Bytes the server has acknowledged. */
  sent: number;
  documentId?: string;
  error?: UploadError;
};

export type UploadState = { items: UploadItem[]; announcement: string };

/** The parts of tus.Upload the manager uses (a fake in tests). */
export interface ResumableUpload {
  start(): void;
  abort(terminate?: boolean): Promise<void>;
}

export type ResumableOptions = {
  endpoint: string;
  storagePath: string;
  bucket: string;
  accessToken: () => Promise<string | null>;
  anonKey: string;
  onProgress: (sent: number, total: number) => void;
  /** Return true to retry (network blips); called before each retry. */
  onRetry: (status: number | null) => boolean;
  onSuccess: () => void;
  onError: (status: number | null) => void;
};

export type UploadDeps = {
  fetch: typeof fetch;
  scan: (file: File) => Promise<ScanResult>;
  createUpload: (file: File, options: ResumableOptions) => ResumableUpload;
  accessToken: () => Promise<string | null>;
  supabaseUrl: string;
  anonKey: string;
  online: () => boolean;
  limits?: Limits;
  sleep?: (ms: number) => Promise<void>;
};

type Internal = UploadItem & {
  file: File;
  sha256?: string;
  force?: boolean;
  upload?: ResumableUpload;
  storagePath?: string;
  cancelled?: boolean;
};

export const MAX_PARALLEL = LIMITS.maxParallelUploads;
export const MAX_FILES = LIMITS.maxFilesPerBatch;
const RUNNING: UploadPhase[] = ["registering", "uploading", "reconnecting", "confirming"];
const BUSY: UploadPhase[] = ["checking", "waiting", ...RUNNING];

let counter = 0;
const nextKey = () => `u${Date.now().toString(36)}${(counter++).toString(36)}`;

export class UploadManager {
  private items: Internal[] = [];
  private listeners = new Set<() => void>();
  private state: UploadState = { items: [], announcement: "" };
  private sleep: (ms: number) => Promise<void>;

  constructor(private deps: UploadDeps) {
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  // ───────────── store ─────────────

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private emit(announcement?: string) {
    this.state = {
      items: this.items.map((i) => ({
        key: i.key,
        notebookId: i.notebookId,
        name: i.name,
        size: i.size,
        phase: i.phase,
        sent: i.sent,
        documentId: i.documentId,
        error: i.error,
      })),
      announcement: announcement ?? this.state.announcement,
    };
    for (const listener of this.listeners) listener();
  }

  private patch(item: Internal, change: Partial<Internal>, announcement?: string) {
    Object.assign(item, change);
    this.emit(announcement);
  }

  /** Whether anything would be lost by closing the tab. */
  busy() {
    return this.items.some((i) => BUSY.includes(i.phase));
  }

  forNotebook(notebookId: string) {
    return this.state.items.filter((i) => i.notebookId === notebookId);
  }

  // ───────────── actions ─────────────

  /** Adds files to a notebook. More than 10 at once: the extra ones are refused. */
  add(notebookId: string, files: File[]) {
    const accepted = files.slice(0, MAX_FILES);
    for (const file of accepted) {
      const item: Internal = {
        key: nextKey(),
        notebookId,
        name: file.name,
        size: file.size,
        phase: "checking",
        sent: 0,
        file,
      };
      this.items.push(item);
      void this.check(item);
    }
    this.emit();
    return { added: accepted.length, refused: files.length - accepted.length };
  }

  /** Cancel: stops the upload, removes the partial file and the row, and drops the item. */
  async cancel(key: string) {
    const item = this.find(key);
    if (!item) return;
    item.cancelled = true;
    // Gone from the list at once; the clean-up runs behind it (a stalled request can make
    // tus's abort wait, so it never blocks the row or the server clean-up).
    const registered = item.documentId && item.phase !== "done" ? item.documentId : null;
    this.items = this.items.filter((i) => i !== item);
    this.emit(`${item.name} cancelled`);
    this.pump();
    const stopped = item.upload?.abort(true).catch(() => undefined);
    await Promise.race([stopped, this.sleep(2000)]);
    if (registered) {
      await this.deps
        .fetch(`/api/documents/${registered}/cancel`, { method: "POST" })
        .catch(() => undefined);
    }
  }

  /** Removes a finished or failed row from the list. */
  remove(key: string) {
    this.items = this.items.filter((i) => i.key !== key || BUSY.includes(i.phase));
    this.emit();
  }

  /** Removes every finished row (the modal's "Clear finished"). */
  clearFinished(notebookId: string) {
    this.items = this.items.filter((i) => i.notebookId !== notebookId || BUSY.includes(i.phase));
    this.emit();
  }

  /** "Resume upload" / "Try again" on a failed row. */
  retry(key: string) {
    const item = this.find(key);
    if (!item || item.phase !== "failed") return;
    if (item.upload && item.error?.code === "upload_interrupted") {
      this.patch(item, { phase: "uploading", error: undefined });
      item.upload.start(); // resumes from the server's offset
      return;
    }
    if (item.documentId && item.error?.code === "confirm_failed") {
      this.patch(item, { error: undefined });
      void this.confirm(item);
      return;
    }
    this.patch(item, { phase: item.sha256 ? "waiting" : "checking", error: undefined, sent: 0 });
    if (item.sha256) this.pump();
    else void this.check(item);
  }

  /** "Add anyway" on a duplicate. */
  addAnyway(key: string) {
    const item = this.find(key);
    if (!item || item.error?.code !== "duplicate_file") return;
    item.force = true;
    this.patch(item, { phase: "waiting", error: undefined });
    this.pump();
  }

  /** The connection came back: resume everything that was waiting for it. */
  resumeAll() {
    for (const item of this.items) {
      if (
        item.upload &&
        (item.phase === "reconnecting" || item.error?.code === "upload_interrupted")
      ) {
        this.patch(item, { phase: "uploading", error: undefined });
        item.upload.start();
      }
    }
  }

  /** The connection dropped: say so on every running upload. */
  markOffline() {
    for (const item of this.items) {
      if (item.phase === "uploading") this.patch(item, { phase: "reconnecting" });
    }
  }

  // ───────────── steps ─────────────

  private find(key: string) {
    return this.items.find((i) => i.key === key);
  }

  private fail(item: Internal, error: UploadError) {
    const copy = error.message ?? errorCopy(error.code, error.vars).message;
    this.patch(item, { phase: "failed", error }, `${item.name}: ${copy}`);
    this.pump();
  }

  private async check(item: Internal) {
    const instant = checkFile(item.file, this.deps.limits);
    if (instant) return this.fail(item, instant);
    try {
      const scan = await this.deps.scan(item.file);
      if (item.cancelled) return;
      const problem = checkScan(scan);
      if (problem) return this.fail(item, problem);
      item.sha256 = scan.sha256;
      this.patch(item, { phase: "waiting" });
      this.pump();
    } catch {
      this.fail(item, { code: "internal" });
    }
  }

  private pump() {
    let running = this.items.filter((i) => RUNNING.includes(i.phase)).length;
    for (const item of this.items) {
      if (running >= MAX_PARALLEL) break;
      if (item.phase !== "waiting") continue;
      running += 1;
      void this.register(item);
    }
  }

  private async errorOf(res: Response): Promise<UploadError> {
    const body = (await res.json().catch(() => ({}))) as {
      code?: string;
      error?: string;
      vars?: Record<string, unknown>;
      existingId?: string;
    };
    const code = body.code ?? "internal";
    const known = errorCopy(code).code === code;
    return {
      code,
      vars: body.vars,
      existingId: body.existingId,
      message: known ? undefined : body.error,
    };
  }

  private async register(item: Internal) {
    this.patch(item, { phase: "registering" });
    let res: Response;
    try {
      res = await this.deps.fetch(`/api/notebooks/${item.notebookId}/documents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: item.name,
          size: item.size,
          sha256: item.sha256,
          force: item.force || undefined,
        }),
      });
    } catch {
      return this.fail(item, { code: "upload_interrupted" });
    }
    if (item.cancelled) return;
    if (!res.ok) return this.fail(item, await this.errorOf(res));
    const created = (await res.json()) as {
      documentId: string;
      storagePath: string;
      bucket?: string;
    };
    item.storagePath = created.storagePath;
    this.patch(item, { documentId: created.documentId, phase: "uploading" });
    this.upload(item, created.bucket ?? STORAGE.bucket);
  }

  private upload(item: Internal, bucket: string) {
    const upload = this.deps.createUpload(item.file, {
      endpoint: `${this.deps.supabaseUrl}/storage/v1/upload/resumable`,
      storagePath: item.storagePath!,
      bucket,
      accessToken: this.deps.accessToken,
      anonKey: this.deps.anonKey,
      onProgress: (sent) => {
        if (item.cancelled) return;
        this.patch(item, { phase: "uploading", sent });
      },
      onRetry: (status) => {
        if (item.cancelled) return false;
        // Client errors won't fix themselves (except locked/too many requests).
        if (status !== null && status >= 400 && status < 500 && status !== 423 && status !== 429) {
          return false;
        }
        this.patch(item, { phase: "reconnecting" });
        return true;
      },
      onSuccess: () => {
        if (item.cancelled) return;
        this.patch(item, { sent: item.size });
        void this.confirm(item);
      },
      onError: (status) => {
        if (item.cancelled) return;
        if (!this.deps.online()) {
          this.patch(item, { phase: "reconnecting" }); // resumeAll() picks it up when online
          return;
        }
        this.fail(item, {
          code: status === 413 ? "file_too_large" : "upload_interrupted",
          vars:
            status === 413
              ? {
                  sizeMb: (item.size / 1024 / 1024).toFixed(1),
                  limitMb: String(LIMITS.maxUploadMb),
                }
              : undefined,
        });
      },
    });
    item.upload = upload;
    upload.start();
  }

  private async confirm(item: Internal) {
    this.patch(item, { phase: "confirming" });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (item.cancelled) return;
      try {
        const res = await this.deps.fetch(`/api/documents/${item.documentId}/uploaded`, {
          method: "POST",
        });
        if (res.ok) {
          this.patch(item, { phase: "done" }, `${item.name} uploaded`);
          this.pump();
          return;
        }
        if (res.status < 500) return this.fail(item, await this.errorOf(res));
      } catch {
        // network: try again below
      }
      await this.sleep(1000 * 2 ** attempt);
    }
    this.fail(item, { code: "confirm_failed", message: "We couldn't start reading this file." });
  }
}

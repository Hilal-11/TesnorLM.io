/**
 * Browser pre-checks (spec section 3, step 1): instant feedback, never trusted. The API and the
 * worker check again. Errors use the contract's codes, so the copy matches the worker's.
 */
import { LIMITS, type ErrorCode } from "@/lib/ingestion/contract";
import { MB, isPdfName, sizeMb } from "@/lib/documents/shared";

/** Contract error codes only (the compiler checks them against contracts/ingestion.json). */
export type PrecheckError = { code: ErrorCode; vars?: Record<string, unknown> };

export type ScanResult = {
  sha256: string;
  /** "%PDF-" within the first 1 KB. */
  isPdf: boolean;
  /** From pdf.js; null when it couldn't tell (the worker decides). */
  pages: number | null;
  /** A password is needed to open it (owner-only restrictions don't count). */
  encrypted: boolean;
};

export type Limits = { maxUploadMb: number; maxPages: number };
export const DEFAULT_LIMITS: Limits = {
  maxUploadMb: LIMITS.maxUploadMb,
  maxPages: LIMITS.maxPages,
};

const PDF_TYPES = new Set(["application/pdf", "application/x-pdf", ""]);

/**
 * Checks that need only the file's name, type and size. Interim until P3.5v2: only PDFs upload
 * (the storage bucket takes PDFs only); v2 then uploads every type and the worker routes it.
 */
export function checkFile(
  file: { name: string; size: number; type: string },
  limits: Limits = DEFAULT_LIMITS,
): PrecheckError | null {
  if (!isPdfName(file.name) || !PDF_TYPES.has(file.type)) return { code: "unsupported_type" };
  if (file.size === 0) return { code: "empty_file" };
  if (file.size > limits.maxUploadMb * MB) {
    return {
      code: "file_too_large",
      vars: { sizeMb: sizeMb(file.size), limitMb: String(limits.maxUploadMb) },
    };
  }
  return null;
}

/**
 * Checks on what the Web Worker found in the bytes. Contract v2 never rejects a PDF for a
 * password or its length: the worker asks for the password and reads up to MAX_PAGES pages.
 */
export function checkScan(scan: ScanResult): PrecheckError | null {
  // Interim until P3.7v2 routes disguised files by their real type.
  if (!scan.isPdf) return { code: "unsupported_type" };
  return null;
}

/** Whether the first kilobyte holds a PDF header (same rule as the worker). */
export function hasPdfHeader(head: Uint8Array) {
  const text = new TextDecoder("latin1").decode(head.subarray(0, 1024));
  return text.includes("%PDF-");
}

export function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Tags the scanner's replies: pdf.js posts its own messages from the same worker. */
export const SCAN_MESSAGE = "tensorlm:precheck";
type ScanReply = { source: typeof SCAN_MESSAGE; result?: ScanResult; error?: string };

/** Runs the scan in a Web Worker so hashing a 50 MB file never freezes the page. */
export function scanInWorker(file: File): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker("/workers/precheck.mjs", { type: "module" }); // public/workers
    const done = () => worker.terminate();
    worker.onmessage = (event: MessageEvent<ScanReply | unknown>) => {
      const reply = event.data as ScanReply | null;
      if (!reply || reply.source !== SCAN_MESSAGE) return; // pdf.js talking to itself
      done();
      if (reply.result) resolve(reply.result);
      else reject(new Error(reply.error ?? "scan failed"));
    };
    worker.onerror = (event) => {
      done();
      reject(new Error(event.message || "precheck worker failed"));
    };
    worker.postMessage(file);
  });
}

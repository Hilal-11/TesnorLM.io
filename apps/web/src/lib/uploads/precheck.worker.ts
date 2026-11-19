/// <reference lib="webworker" />
/**
 * Off the main thread: SHA-256 of the whole file (Web Crypto), the "%PDF-" header, and a quick
 * open with pdf.js for the page count and whether a password is needed. pdf.js runs inside this
 * worker (its message handler is registered on globalThis), so no nested worker is created.
 * pdf.js also attaches itself to this worker and posts its own messages, so ours are tagged.
 */
import { SCAN_MESSAGE, hasPdfHeader, toHex, type ScanResult } from "./precheck";

async function openWithPdfJs(
  bytes: Uint8Array,
): Promise<{ pages: number | null; encrypted: boolean }> {
  try {
    const [pdfjs, pdfjsWorker] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs"),
    ]);
    (globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = pdfjsWorker;
    const task = pdfjs.getDocument({
      data: bytes,
      disableFontFace: true,
      disableAutoFetch: true,
      disableStream: true,
      useSystemFonts: false,
      stopAtErrors: false,
    });
    try {
      const doc = await task.promise;
      const pages = doc.numPages;
      await task.destroy();
      return { pages, encrypted: false };
    } catch (err) {
      await task.destroy().catch(() => undefined);
      const name = (err as { name?: string } | null)?.name;
      return { pages: null, encrypted: name === "PasswordException" };
    }
  } catch {
    return { pages: null, encrypted: false }; // pdf.js couldn't load: the worker will decide
  }
}

self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const buffer = await event.data.arrayBuffer();
    const sha256 = toHex(await crypto.subtle.digest("SHA-256", buffer));
    const isPdf = hasPdfHeader(new Uint8Array(buffer, 0, Math.min(1024, buffer.byteLength)));
    const opened = isPdf
      ? await openWithPdfJs(new Uint8Array(buffer))
      : { pages: null, encrypted: false };
    const result: ScanResult = { sha256, isPdf, ...opened };
    self.postMessage({ source: SCAN_MESSAGE, result });
  } catch (err) {
    self.postMessage({
      source: SCAN_MESSAGE,
      error: err instanceof Error ? err.message : "scan failed",
    });
  }
};

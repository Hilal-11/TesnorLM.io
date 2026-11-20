// Upload pre-check, off the main thread (served as a static file: Turbopack's production build
// hangs on bundled Web Worker entries). SHA-256 of the file, the "%PDF-" header, and a quick open
// with pdf.js (public/vendor/pdfjs, copied by scripts/sync-pdfjs.mjs) for the page count and
// whether a password is needed. Replies are tagged: pdf.js posts its own messages here too.
// Keep in step with src/lib/uploads/precheck.ts (ScanResult, SCAN_MESSAGE).
const SCAN_MESSAGE = "tensorlm:precheck";

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");

const hasPdfHeader = (bytes) =>
  new TextDecoder("latin1").decode(bytes.subarray(0, 1024)).includes("%PDF-");

async function openWithPdfJs(bytes) {
  try {
    const base = `${self.location.origin}/vendor/pdfjs`;
    const [pdfjs, pdfjsWorker] = await Promise.all([
      import(`${base}/pdf.min.mjs`),
      import(`${base}/pdf.worker.min.mjs`),
    ]);
    self.pdfjsWorker = pdfjsWorker; // run pdf.js in this worker, no nested worker
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
      return { pages: null, encrypted: err?.name === "PasswordException" };
    }
  } catch {
    return { pages: null, encrypted: false }; // pdf.js unavailable: the worker service decides
  }
}

self.onmessage = async (event) => {
  try {
    const buffer = await event.data.arrayBuffer();
    const sha256 = toHex(await crypto.subtle.digest("SHA-256", buffer));
    const isPdf = hasPdfHeader(new Uint8Array(buffer, 0, Math.min(1024, buffer.byteLength)));
    const opened = isPdf
      ? await openWithPdfJs(new Uint8Array(buffer))
      : { pages: null, encrypted: false };
    self.postMessage({ source: SCAN_MESSAGE, result: { sha256, isPdf, ...opened } });
  } catch (err) {
    self.postMessage({
      source: SCAN_MESSAGE,
      error: err instanceof Error ? err.message : "scan failed",
    });
  }
};

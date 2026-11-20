"use client";

import type * as PdfJs from "pdfjs-dist";

export type PdfJsModule = typeof PdfJs;

let loading: Promise<PdfJsModule> | null = null;

/**
 * pdf.js from public/vendor/pdfjs (copied by scripts/sync-pdfjs.mjs), loaded at runtime and not
 * bundled: Turbopack's production build hangs on pdf.js' worker entry.
 */
export function loadPdfJs(): Promise<PdfJsModule> {
  loading ??= (async () => {
    const base = `${window.location.origin}/vendor/pdfjs`;
    const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${base}/pdf.min.mjs`)) as PdfJsModule;
    mod.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.mjs`;
    return mod;
  })().catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

export type Box = { page: number; l: number; t: number; r: number; b: number };

/** A bbox in PDF points (top-left origin, docs/specs/ingestion.md §10) → CSS pixels at `scale`. */
export function boxToRect(box: Box, scale: number) {
  const left = Math.min(box.l, box.r) * scale;
  const top = Math.min(box.t, box.b) * scale;
  return {
    left,
    top,
    width: Math.abs(box.r - box.l) * scale,
    height: Math.abs(box.b - box.t) * scale,
  };
}

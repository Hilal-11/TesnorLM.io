"use client";

import { useSyncExternalStore } from "react";
import * as tus from "tus-js-client";
import { supabasePublicConfig } from "@/lib/public-env";
import { createClient } from "@/lib/supabase/client";
import { UploadManager, type ResumableOptions, type UploadState } from "./manager";
import { scanInWorker } from "./precheck";

/** Supabase Storage's resumable endpoint accepts exactly 6 MB chunks. */
const CHUNK = 6 * 1024 * 1024;
/** Retries over about two minutes; after that the row offers "Resume upload". */
const RETRY_DELAYS = [0, 1000, 2000, 4000, 8000, 15000, 30000, 60000];

function createTusUpload(file: File, o: ResumableOptions) {
  return new tus.Upload(file, {
    endpoint: o.endpoint,
    chunkSize: CHUNK,
    retryDelays: RETRY_DELAYS,
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    headers: { apikey: o.anonKey, "x-upsert": "false" },
    metadata: {
      bucketName: o.bucket,
      objectName: o.storagePath,
      contentType: "application/pdf",
      cacheControl: "3600",
    },
    // A fresh token for every request: long uploads outlive an access token.
    onBeforeRequest: async (req) => {
      const token = await o.accessToken();
      if (token) req.setHeader("authorization", `Bearer ${token}`);
    },
    onProgress: (sent, total) => o.onProgress(sent, total),
    onShouldRetry: (err) => {
      const status = (err as tus.DetailedError).originalResponse?.getStatus() ?? null;
      return o.onRetry(status || null);
    },
    onSuccess: () => o.onSuccess(),
    onError: (err) => {
      const status = (err as tus.DetailedError).originalResponse?.getStatus() ?? null;
      o.onError(status || null);
    },
  });
}

let manager: UploadManager | null = null;

export function getUploadManager() {
  if (manager) return manager;
  const { url, key } = supabasePublicConfig();
  const supabase = createClient();
  manager = new UploadManager({
    fetch: (input, init) => fetch(input, init),
    scan: scanInWorker,
    createUpload: createTusUpload,
    accessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
    supabaseUrl: url,
    anonKey: key,
    online: () => navigator.onLine,
  });
  const m = manager;
  window.addEventListener("online", () => m.resumeAll());
  window.addEventListener("offline", () => m.markOffline());
  // Closing the tab mid-upload loses the upload: ask first.
  window.addEventListener("beforeunload", (event) => {
    if (!m.busy()) return;
    event.preventDefault();
    event.returnValue = "";
  });
  return manager;
}

const EMPTY: UploadState = { items: [], announcement: "" };

/** Upload rows (all notebooks), live. Server render: none. */
export function useUploads() {
  return useSyncExternalStore(
    (listener) => getUploadManager().subscribe(listener),
    () => getUploadManager().getSnapshot(),
    () => EMPTY,
  );
}

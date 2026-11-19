"use client";

/** Downloads a source's original (the route answers with a 60-second signed link). */
export function downloadOriginal(documentId: string) {
  const link = document.createElement("a");
  link.href = `/api/documents/${documentId}/download`;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}

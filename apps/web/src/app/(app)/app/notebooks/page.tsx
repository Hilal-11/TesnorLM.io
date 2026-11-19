import { NotebookPen } from "lucide-react";
import type { Metadata } from "next";
import { PlaceholderPage } from "../_components/placeholder-page";

export const metadata: Metadata = { title: "Notebooks" };

export default function NotebooksPage() {
  return (
    <PlaceholderPage
      title="Notebooks"
      description="Each notebook holds the sources for one topic and the chats about them."
      icon={NotebookPen}
      emptyTitle="No notebooks yet"
      emptyBody="Create a notebook, add a paper to it, then ask anything about it."
      actionLabel="New notebook"
    />
  );
}

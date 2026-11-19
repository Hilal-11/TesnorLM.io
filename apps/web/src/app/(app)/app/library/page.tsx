import { Library } from "lucide-react";
import type { Metadata } from "next";
import { PlaceholderPage } from "../_components/placeholder-page";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <PlaceholderPage
      title="Library"
      description="Every source you've added, across all notebooks."
      icon={Library}
      emptyTitle="Your library is empty"
      emptyBody="Sources you add to any notebook show up here."
      actionLabel="Add source"
    />
  );
}

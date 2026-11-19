import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { PlaceholderPage } from "../_components/placeholder-page";

export const metadata: Metadata = { title: "Lessons" };

export default function LessonsPage() {
  return (
    <PlaceholderPage
      title="Lessons"
      description="Step-by-step explanations TensorLM writes from your sources."
      icon={BookOpen}
      emptyTitle="No lessons yet"
      emptyBody="Ask for a lesson on any topic in your sources and it appears here."
      actionLabel="Write a lesson"
    />
  );
}

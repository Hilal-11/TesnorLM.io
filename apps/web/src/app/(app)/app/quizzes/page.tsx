import { Brain } from "lucide-react";
import type { Metadata } from "next";
import { PlaceholderPage } from "../_components/placeholder-page";

export const metadata: Metadata = { title: "Quizzes" };

export default function QuizzesPage() {
  return (
    <PlaceholderPage
      title="Quizzes"
      description="Check what you understood, one question at a time."
      icon={Brain}
      emptyTitle="No quizzes yet"
      emptyBody="Turn any notebook into a short quiz to test yourself."
      actionLabel="Start a quiz"
    />
  );
}

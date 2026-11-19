import { CircleHelp } from "lucide-react";
import type { Metadata } from "next";
import { PlaceholderPage } from "../_components/placeholder-page";

export const metadata: Metadata = { title: "Help" };

export default function HelpPage() {
  return (
    <PlaceholderPage
      title="Help"
      description="Guides, shortcuts and how to reach us."
      icon={CircleHelp}
      emptyTitle="Guides are on their way"
      emptyBody="Until then, press Ctrl K to jump anywhere, or open Keyboard shortcuts from your account menu."
      actionLabel="Read the guides"
    />
  );
}

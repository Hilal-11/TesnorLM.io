import { Upload } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { AppShell } from "../../(app)/app/_components/app-shell";
import { PageHeader } from "../../(app)/app/_components/page-header";

export const metadata: Metadata = { title: "Shell preview" };

/** Dev only: the signed-in shell with a sample person, for design review and axe. */
export default function AppShellPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <AppShell
      previewPath="/app"
      user={{
        id: "preview",
        email: "asha.rao@example.com",
        name: "Asha Rao",
        firstName: "Asha",
        avatarUrl: null,
        level: "intermediate",
        plan: "Free",
      }}
    >
      <div className="flex max-w-5xl flex-col gap-8">
        <PageHeader
          title="Welcome, Asha"
          description="Add a paper, notes or a dataset, then ask anything about it."
        />
        <div className="rounded-md border border-rule">
          <EmptyState
            graphPaper
            titleAs="h2"
            icon={Upload}
            title="Add your first source"
            description="PDFs, notes, images and CSVs. TensorLM reads them and explains them with diagrams."
            action={{
              label: "Add source",
              icon: Upload,
              disabledReason: "Coming in the next update",
            }}
          />
        </div>
      </div>
    </AppShell>
  );
}

import { Upload } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { firstName, getProfile } from "@/lib/profile";
import { PageHeader } from "./_components/page-header";
import { WelcomeToast } from "./_components/welcome-toast";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const profile = await getProfile();
  const name = firstName(profile?.full_name);
  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <Suspense>
        <WelcomeToast />
      </Suspense>
      <PageHeader
        title={name ? `Welcome, ${name}` : "Welcome"}
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
  );
}

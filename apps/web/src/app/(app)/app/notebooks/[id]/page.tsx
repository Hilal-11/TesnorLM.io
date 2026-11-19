import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { DelayedSkeleton, SkeletonSourceCard } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { listSources } from "@/lib/documents/server";
import { getNotebook } from "@/lib/notebooks/repo";
import { createClient } from "@/lib/supabase/server";
import { NotebookWorkspace } from "./_components/notebook-workspace";

export const metadata: Metadata = { title: "Notebook" };

export default function NotebookPage({ params }: PageProps<"/app/notebooks/[id]">) {
  return (
    <Suspense
      fallback={
        <DelayedSkeleton label="Loading notebook">
          <div className="flex max-w-sm flex-col gap-3">
            <SkeletonSourceCard />
            <SkeletonSourceCard />
          </div>
        </DelayedSkeleton>
      }
    >
      <NotebookData params={params} />
    </Suspense>
  );
}

async function NotebookData({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/app/notebooks/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const notebook = await getNotebook(db, id);
  if (!notebook) notFound();
  const sources = await listSources(db, id);
  return <NotebookWorkspace notebook={notebook} initialSources={sources} />;
}

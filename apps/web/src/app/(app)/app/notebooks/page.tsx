import type { Metadata } from "next";
import { Suspense } from "react";
import { DelayedSkeleton, Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { listNotebooks } from "@/lib/notebooks/repo";
import { createClient } from "@/lib/supabase/server";
import { NotebooksError } from "./_components/notebooks-error";
import { NotebooksView } from "./_components/notebooks-view";

export const metadata: Metadata = { title: "Notebooks" };

export default function NotebooksPage() {
  return (
    <Suspense fallback={<NotebooksSkeleton />}>
      <NotebooksData />
    </Suspense>
  );
}

async function NotebooksData() {
  await requireUser("/app/notebooks");
  const notebooks = await listNotebooks(await createClient()).catch((err: unknown) => {
    logger.error("notebooks list failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  });
  if (!notebooks) return <NotebooksError />;
  return <NotebooksView initialNotebooks={notebooks} />;
}

/** Matches the grid's layout; appears only after 300 ms (skill 10.6). */
function NotebooksSkeleton() {
  return (
    <DelayedSkeleton label="Loading notebooks">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-full max-w-xl" />
        <div className="grid grid-cols-1 gap-4 min-[1440px]:grid-cols-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-md border border-rule p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </DelayedSkeleton>
  );
}

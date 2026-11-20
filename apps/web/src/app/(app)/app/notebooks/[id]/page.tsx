import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { DelayedSkeleton, SkeletonSourceCard } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { profileLevel } from "@/lib/chats/level";
import { listChats, listMessages } from "@/lib/chats/server";
import { listSources } from "@/lib/documents/server";
import { getNotebook } from "@/lib/notebooks/repo";
import { createAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NotebookWorkspace } from "./_components/notebook-workspace";

export const metadata: Metadata = { title: "Notebook" };

export default function NotebookPage({ params, searchParams }: PageProps<"/app/notebooks/[id]">) {
  return (
    <Suspense
      fallback={
        <DelayedSkeleton label="Loading notebook">
          <div className="flex max-w-sm flex-col gap-3 p-4">
            <SkeletonSourceCard />
            <SkeletonSourceCard />
          </div>
        </DelayedSkeleton>
      }
    >
      <NotebookData params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function NotebookData({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const user = await requireUser(`/app/notebooks/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const notebook = await getNotebook(db, id);
  if (!notebook) notFound();
  const [sources, chats, level, query] = await Promise.all([
    listSources(db, id),
    listChats(db, id),
    profileLevel(db, user.id),
    searchParams,
  ]);
  // ?chat=<id> opens that chat; otherwise the most recent one.
  const wanted = typeof query.chat === "string" ? query.chat : null;
  const chat = chats.find((c) => c.id === wanted) ?? chats[0] ?? null;
  const messages = chat ? await listMessages(db, createAdmin(), chat.id) : [];
  return (
    <NotebookWorkspace
      notebook={notebook}
      initialSources={sources}
      initialChats={chats}
      initialChatId={chat?.id ?? null}
      initialMessages={messages}
      defaultLevel={level}
    />
  );
}

"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "../../_components/page-header";

/** Inline error: what happened, and one way to fix it. */
export function NotebooksError() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Notebooks" description="Group sources by course, topic or exam." />
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-md border border-rule p-6"
      >
        <p className="flex items-center gap-2 text-body text-ink">
          <CircleAlert aria-hidden className="size-4 text-danger-strong" />
          We couldn&apos;t load your notebooks.
        </p>
        <p className="text-small text-graphite">Check your connection, then try again.</p>
        <Button
          variant="secondary"
          leadingIcon={RotateCcw}
          loading={pending}
          onClick={() => startTransition(() => router.refresh())}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}

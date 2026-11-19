"use client";

import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Errors inside the app: say what happened and offer the fix (skill 9). */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex max-w-xl flex-col items-start gap-4">
      <CircleAlert aria-hidden className="size-6 text-danger-strong" />
      <div className="flex flex-col gap-1">
        <h1 className="text-h2 text-ink">This page didn&apos;t load</h1>
        <p className="text-body text-graphite">
          Your connection may have dropped, or our server didn&apos;t answer in time. Your work is
          saved.
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}

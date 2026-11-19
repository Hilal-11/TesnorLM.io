"use client";

import { FilePlus2 } from "lucide-react";
import { useEffect } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import type { Notebook } from "@/lib/notebooks/shared";
import { PageHeader } from "../../../_components/page-header";
import { touchNotebook } from "../../actions";
import { ColorDot, StatusWord, formatExamDate } from "../../_components/notebook-visuals";

/** A notebook's workspace. P3.11 adds the sources panel; Phase 4 adds the conversation. */
export function NotebookWorkspace({ notebook }: { notebook: Notebook }) {
  // Counts as "opened" only when someone actually looks at it (not on link prefetch).
  useEffect(() => {
    void touchNotebook(null, { id: notebook.id });
  }, [notebook.id]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <ColorDot color={notebook.color} className="size-3" />
            {notebook.title}
          </span>
        }
        description={notebook.description ?? undefined}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-graphite">
        <StatusWord status={notebook.status} />
        {notebook.subject && <span>{notebook.subject}</span>}
        {notebook.exam_date && <span>Exam {formatExamDate(notebook.exam_date)}</span>}
      </div>
      <div className="rounded-md border border-rule">
        <EmptyState
          graphPaper
          titleAs="h2"
          icon={FilePlus2}
          title="Add your first source"
          description="Add a paper, notes or a dataset, then ask anything about it."
          action={{
            label: "Add source",
            icon: FilePlus2,
            disabledReason: "Uploading sources arrives in the next update.",
          }}
        />
      </div>
    </div>
  );
}

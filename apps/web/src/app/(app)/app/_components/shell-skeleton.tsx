import { Skeleton } from "@/components/ui/skeleton";

/** Same layout as the shell (sidebar, top bar, page header), shown while the session loads. */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh bg-paper">
      <div className="hidden w-[264px] shrink-0 flex-col gap-6 border-r border-rule p-3 lg:flex">
        <Skeleton className="h-12 w-full rounded-md" />
        <Skeleton className="h-9 w-full" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 items-center gap-3 border-b border-rule px-4">
          <Skeleton className="h-5 w-48" />
        </div>
        <PageSkeleton />
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-4 pt-8 md:px-8">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-64 w-full rounded-md" />
    </div>
  );
}

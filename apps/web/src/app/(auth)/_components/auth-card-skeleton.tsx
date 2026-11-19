import { Skeleton } from "@/components/ui/skeleton";

/** Same shape as the auth card, shown while request-time parts stream in. */
export function AuthCardSkeleton() {
  return (
    <div className="flex w-full max-w-[400px] flex-col gap-6 rounded-lg border border-transparent bg-sheet p-6 shadow-2 sm:p-8 dark:border-rule">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

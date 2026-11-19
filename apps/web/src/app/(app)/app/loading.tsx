import { PageSkeleton } from "./_components/shell-skeleton";

export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      <PageSkeleton />
    </div>
  );
}

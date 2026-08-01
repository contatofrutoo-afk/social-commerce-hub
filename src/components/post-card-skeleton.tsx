import { Skeleton } from "@/components/ui/skeleton";

export function PostCardSkeleton() {
  return (
    <article className="post-card">
      <header className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </header>
      <Skeleton className="h-72 w-full" />
      <div className="px-4 py-3">
        <Skeleton className="h-4 w-full" />
      </div>
      <div className="flex items-center gap-2 border-t px-4 py-3">
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
    </article>
  );
}

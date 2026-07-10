import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder con la misma silueta que PublicationCard (avatar + 2 líneas de
 * cabecera, título, 3 líneas de contenido, franja de acciones), para que el
 * layout no salte cuando llegan los datos reales. */
export function PublicationCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 pt-4">
        <Skeleton className="h-9 w-9 rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="px-5 pt-3 space-y-2">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
      <div className="flex items-center gap-4 px-5 py-4">
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
    </div>
  );
}

/** N skeletons apilados como el feed real (PublicationList). */
export function PublicationListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => <PublicationCardSkeleton key={i} />)}
    </div>
  );
}

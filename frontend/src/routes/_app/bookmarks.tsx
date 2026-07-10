import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchFeed } from "@/lib/api";
import { useBookmarks } from "@/lib/bookmarks";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { PublicationList } from "@/components/publications/PublicationList";
import { PublicationListSkeleton } from "@/components/publications/PublicationCardSkeleton";
import { Bookmark } from "lucide-react";
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/bookmarks")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Guardados — Readuls" }] }),
  component: BookmarksPage,
});

function BookmarksPage() {
  const { ids } = useBookmarks();
  const { data, isLoading } = useQuery({ queryKey: ["feed"], queryFn: () => fetchFeed() });
  const items = (data ?? []).filter((p) => ids.includes(p.id));

  return (
    <div className="max-w-2xl mx-auto w-full">
      <FeedHeader title="Guardados" subtitle="Publicaciones que marcaste para volver más tarde" />
      {isLoading ? (
        <PublicationListSkeleton count={2} />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Bookmark className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Aún no tienes publicaciones guardadas.</p>
          <Link to="/" className="mt-3 inline-block text-primary text-sm hover:underline">Explorar el feed</Link>
        </div>
      ) : (
        <PublicationList items={items} />
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchFeed } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { FilterableFeed } from "@/components/feed/FilterableFeed";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Inicio — Readuls" },
      { name: "description", content: "Feed principal de Readuls: publicaciones de todas las comunidades ULS." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const me = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["feed", me?.id],
    queryFn: () => fetchFeed(me?.id),
  });

  return (
    <div className="max-w-2xl mx-auto w-full">
      <FeedHeader title="Inicio" subtitle="Publicaciones de todas las comunidades" />
      {isLoading ? (
        <p className="text-center text-muted-foreground py-10">Cargando publicaciones…</p>
      ) : isError ? (
        <p className="text-center text-destructive py-10">No se pudo cargar el feed. ¿El backend está en :5000?</p>
      ) : (
        <FilterableFeed items={data ?? []} />
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { fetchFeedPage } from "@/lib/api";
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
  // Carga infinita: páginas de 20 con cursor. Cada página la resuelve el
  // backend con 4 consultas en lote (sin N+1), así el feed escala con miles
  // de publicaciones sin degradarse.
  const {
    data, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["feed", me?.id],
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam, me?.id),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextCursor,
  });
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  // Sentinel: cuando el marcador se acerca al viewport (600px de anticipo),
  // se pide la página siguiente — el usuario no ve cortes al scrollear.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="max-w-2xl mx-auto w-full">
      <FeedHeader title="Inicio" subtitle="Publicaciones de todas las comunidades" />
      {isLoading ? (
        <p className="text-center text-muted-foreground py-10">Cargando publicaciones…</p>
      ) : isError ? (
        <p className="text-center text-destructive py-10">No se pudo cargar el feed.</p>
      ) : (
        <>
          <FilterableFeed items={items} />
          <div ref={sentinelRef} aria-hidden />
          {isFetchingNextPage && (
            <p className="text-center text-muted-foreground py-4 text-sm">Cargando más…</p>
          )}
          {!hasNextPage && items.length > 0 && (
            <p className="text-center text-muted-foreground py-4 text-xs">No hay más publicaciones.</p>
          )}
        </>
      )}
    </div>
  );
}

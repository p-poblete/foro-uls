import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchFeed } from "@/lib/api";
import { PublicationList } from "@/components/publications/PublicationList";
import { FeedHeader } from "@/components/feed/FeedHeader";

export const Route = createFileRoute("/_app/feed/announcements")({
  head: () => ({
    meta: [
      { title: "Anuncios ULS — Readuls" },
      { name: "description", content: "Anuncios oficiales de la Universidad La Salle." },
    ],
  }),
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["feed"], queryFn: () => fetchFeed() });
  const items = (data ?? []).filter((p) => p.label === "ANNOUNCEMENT" || p.community?.name === "Anuncios_ULS");
  return (
    <div className="max-w-2xl mx-auto w-full">
      <FeedHeader title="Anuncios ULS" subtitle="Comunicados institucionales oficiales" />
      {isLoading ? <p className="text-muted-foreground py-6">Cargando…</p> : <PublicationList items={items} />}
    </div>
  );
}

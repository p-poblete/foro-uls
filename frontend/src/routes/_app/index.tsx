import { createFileRoute } from "@tanstack/react-router";
import { PUBLICATIONS } from "@/lib/mock-data";
import { PublicationList } from "@/components/publications/PublicationList";
import { FeedHeader } from "@/components/feed/FeedHeader";

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
  return (
    <div className="max-w-2xl mx-auto w-full">
      <FeedHeader title="Inicio" subtitle="Publicaciones de todas las comunidades" />
      <PublicationList items={PUBLICATIONS} />
    </div>
  );
}

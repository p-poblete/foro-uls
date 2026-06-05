import { createFileRoute } from "@tanstack/react-router";
import { PUBLICATIONS } from "@/lib/mock-data";
import { PublicationList } from "@/components/publications/PublicationList";
import { FeedHeader } from "@/components/feed/FeedHeader";

export const Route = createFileRoute("/_app/feed/announcements")({
  head: () => ({
    meta: [
      { title: "Anuncios ULS — Readuls" },
      { name: "description", content: "Anuncios oficiales de la Universidad La Salle." },
    ],
  }),
  component: () => {
    const items = PUBLICATIONS.filter((p) => p.label === "ANNOUNCEMENT" || p.community?.name === "Anuncios_ULS");
    return (
      <div className="max-w-2xl mx-auto w-full">
        <FeedHeader title="Anuncios ULS" subtitle="Comunicados institucionales oficiales" />
        <PublicationList items={items} />
      </div>
    );
  },
});

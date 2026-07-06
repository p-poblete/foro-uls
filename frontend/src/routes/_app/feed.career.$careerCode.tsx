import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchFeed, fetchCareers } from "@/lib/api";
import { PublicationList } from "@/components/publications/PublicationList";
import { FeedHeader } from "@/components/feed/FeedHeader";

export const Route = createFileRoute("/_app/feed/career/$careerCode")({
  head: () => ({ meta: [{ title: "Carrera — Readuls" }] }),
  component: CareerFeedPage,
});

function CareerFeedPage() {
  const { careerCode } = Route.useParams();
  const { data: careers } = useQuery({ queryKey: ["careers"], queryFn: fetchCareers });
  const { data: feed } = useQuery({ queryKey: ["feed"], queryFn: () => fetchFeed() });
  const career = (careers ?? []).find((c) => c.code === careerCode);

  if (careers && !career) {
    return <p className="text-destructive">Carrera no encontrada.</p>;
  }
  // Filtra publicaciones cuyos autores pertenecen a esa carrera
  const items = (feed ?? []).filter((p) => career && p.author?.career_id === career.id);
  return (
    <div className="max-w-2xl mx-auto w-full">
      <FeedHeader title={career?.name ?? "Carrera"} subtitle="Publicaciones filtradas por carrera" />
      <PublicationList items={items} />
    </div>
  );
}

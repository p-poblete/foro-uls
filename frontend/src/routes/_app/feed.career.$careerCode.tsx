import { createFileRoute, notFound } from "@tanstack/react-router";
import { CAREERS, PUBLICATIONS } from "@/lib/mock-data";
import { PublicationList } from "@/components/publications/PublicationList";
import { FeedHeader } from "@/components/feed/FeedHeader";

export const Route = createFileRoute("/_app/feed/career/$careerCode")({
  loader: ({ params }) => {
    const career = CAREERS.find((c) => c.code === params.careerCode);
    if (!career) throw notFound();
    return { career };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.career.name ?? "Carrera"} — Readuls` },
      { name: "description", content: `Publicaciones de la carrera ${loaderData?.career.name}.` },
    ],
  }),
  errorComponent: ({ error }) => <p className="text-destructive">{error.message}</p>,
  notFoundComponent: () => <p>Carrera no encontrada.</p>,
  component: CareerFeedPage,
});

function CareerFeedPage() {
  const { career } = Route.useLoaderData();
  // Filtra publicaciones cuyos autores pertenecen a esa carrera
  const items = PUBLICATIONS.filter((p) => p.author?.career_id === career.id);
  return (
    <div className="max-w-2xl mx-auto w-full">
      <FeedHeader title={career.name} subtitle="Publicaciones filtradas por carrera" />
      <PublicationList items={items} />
    </div>
  );
}

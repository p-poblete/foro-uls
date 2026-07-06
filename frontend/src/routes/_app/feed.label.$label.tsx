import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchFeed } from "@/lib/api";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { FilterableFeed } from "@/components/feed/FilterableFeed";
import { LABEL_LABELS, ALL_LABELS } from "@/constants";
import type { PublicationLabel } from "@/types";

export const Route = createFileRoute("/_app/feed/label/$label")({
  loader: ({ params }) => {
    const label = params.label as PublicationLabel;
    if (!ALL_LABELS.includes(label)) throw notFound();
    return { label };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData ? LABEL_LABELS[loaderData.label] : "Etiqueta"} — Readuls` }],
  }),
  notFoundComponent: () => <p>Etiqueta no válida.</p>,
  component: LabelFeedPage,
});

function LabelFeedPage() {
  const { label } = Route.useLoaderData() as { label: PublicationLabel };
  const { data } = useQuery({ queryKey: ["feed"], queryFn: () => fetchFeed() });
  const items = (data ?? []).filter((p) => p.label === label);
  return (
    <div className="max-w-2xl mx-auto w-full">
      <FeedHeader
        title={`Etiqueta: ${LABEL_LABELS[label]}`}
        subtitle={`Publicaciones marcadas como ${LABEL_LABELS[label].toLowerCase()}`}
      />
      <FilterableFeed items={items} showLabelFilter={false} />
    </div>
  );
}

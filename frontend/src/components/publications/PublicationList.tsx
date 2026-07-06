import { PublicationCard } from "@/components/publications/PublicationCard";
import type { Publication } from "@/types";

export function PublicationList({ items }: { items: Publication[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
        No hay publicaciones para mostrar todavía.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {items.map((p) => <PublicationCard key={p.id} pub={p} />)}
    </div>
  );
}

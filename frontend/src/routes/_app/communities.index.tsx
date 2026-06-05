import { createFileRoute, Link } from "@tanstack/react-router";
import { COMMUNITIES } from "@/lib/mock-data";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, compactNumber } from "@/lib/format";
import { PRIVACY_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_app/communities/")({
  head: () => ({
    meta: [
      { title: "Comunidades — Readuls" },
      { name: "description", content: "Explora todas las comunidades de Readuls." },
    ],
  }),
  component: CommunitiesPage,
});

function CommunitiesPage() {
  return (
    <div className="max-w-3xl mx-auto w-full">
      <FeedHeader
        title="Explorar comunidades"
        subtitle="Espacios temáticos creados por estudiantes ULS"
        action={
          <Button asChild className="rounded-full">
            <Link to="/communities/create"><Plus className="h-4 w-4 mr-1" /> Crear</Link>
          </Button>
        }
      />
      <div className="grid sm:grid-cols-2 gap-4">
        {COMMUNITIES.map((c) => (
          <Link
            key={c.id}
            to="/communities/$id"
            params={{ id: c.id }}
            className="group rounded-xl border border-border bg-card p-4 shadow-sm hover:border-primary/40 transition"
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={c.profile_image ?? undefined} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials(c.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate group-hover:text-primary">{c.name}</h3>
                  <span className="text-[10px] uppercase tracking-wide rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
                    {PRIVACY_LABELS[c.privacy_level]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{compactNumber(c.member_count)} miembros</p>
                <p className="text-sm text-foreground/80 mt-2 line-clamp-2">{c.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

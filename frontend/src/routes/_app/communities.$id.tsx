import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { COMMUNITIES, PUBLICATIONS, USERS } from "@/lib/mock-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, compactNumber, timeAgo } from "@/lib/format";
import { PRIVACY_DESCRIPTIONS, PRIVACY_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import { PublicationList } from "@/components/publications/PublicationList";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/communities/$id")({
  loader: ({ params }) => {
    const community = COMMUNITIES.find((c) => c.id === params.id);
    if (!community) throw notFound();
    return { community };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.community.name ?? "Comunidad"} — Readuls` },
      { name: "description", content: loaderData?.community.description ?? "" },
    ],
  }),
  errorComponent: ({ error }) => <p className="text-destructive">{error.message}</p>,
  notFoundComponent: () => <p>Comunidad no encontrada.</p>,
  component: CommunityPage,
});

function CommunityPage() {
  const { community } = Route.useLoaderData();
  const user = useAuth();
  const [joined, setJoined] = useState(!!community.is_member);
  const creator = USERS.find((u) => u.id === community.creator_id);
  const pubs = PUBLICATIONS.filter((p) => p.community_id === community.id);

  function toggleJoin() {
    if (!user) return toast.error("Inicia sesión para unirte.");
    if (community.privacy_level === "PRIVATE") return toast("Esta comunidad es por invitación.");
    setJoined(!joined);
    toast.success(joined ? `Has salido de ${community.name}` : `Te uniste a ${community.name}`);
  }

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
        <div className="h-32 bg-gradient-to-r from-primary to-primary-hover" />
        <div className="p-5 flex items-start gap-4">
          <Avatar className="h-20 w-20 -mt-12 border-4 border-card shadow">
            <AvatarImage src={community.profile_image ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-2xl">{initials(community.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold">{community.name}</h1>
              <span className="text-[10px] uppercase tracking-wide rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
                {PRIVACY_LABELS[community.privacy_level]}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {compactNumber(community.member_count)} miembros · Creada {timeAgo(community.created_at)}
            </p>
            <p className="text-sm mt-2">{community.description}</p>
            <p className="text-xs text-muted-foreground mt-1">{PRIVACY_DESCRIPTIONS[community.privacy_level]}</p>
          </div>
          <Button
            onClick={toggleJoin}
            variant={joined ? "outline" : "default"}
            className="rounded-full"
          >
            {joined ? "Unido" : "Unirse"}
          </Button>
        </div>
      </div>

      <div className="mt-6 grid lg:grid-cols-[1fr_260px] gap-6">
        <div>
          <h2 className="font-display text-lg font-semibold mb-3">Publicaciones</h2>
          <PublicationList items={pubs} />
        </div>
        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-2">Sobre la comunidad</h3>
            <p className="text-sm text-muted-foreground">{community.description}</p>
            {creator && (
              <div className="mt-3 text-xs text-muted-foreground">
                Creada por{" "}
                <Link to="/users/$id" params={{ id: creator.id }} className="text-primary hover:underline">
                  {creator.username}
                </Link>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-2">Reglas</h3>
            <ol className="list-decimal list-inside text-sm space-y-1 text-foreground/80">
              <li>Respeto a todos los miembros.</li>
              <li>Sin spam ni autopromoción excesiva.</li>
              <li>Contenido relevante al tema de la comunidad.</li>
              <li>Citar fuentes cuando corresponda.</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCommunity, fetchCommunityPosts, fetchUser, joinCommunity, leaveCommunity } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, compactNumber, timeAgo } from "@/lib/format";
import { PRIVACY_DESCRIPTIONS, PRIVACY_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import { PublicationList } from "@/components/publications/PublicationList";
import { useAuth } from "@/lib/auth";
import { Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/communities/$id/")({
  head: () => ({ meta: [{ title: "Comunidad — Readuls" }] }),
  component: CommunityPage,
});

function CommunityPage() {
  const { id } = Route.useParams();
  const user = useAuth();
  const { data: community, isLoading, isError } = useQuery({
    queryKey: ["community", id],
    queryFn: () => fetchCommunity(id),
  });
  const { data: pubs, error: pubsError } = useQuery({
    queryKey: ["community-posts", id, user?.id],
    queryFn: () => fetchCommunityPosts(id, user?.id),
    retry: (count, e) => !(e instanceof ApiError && e.status === 403) && count < 2,
  });
  // 403 = comunidad privada y no eres miembro (los moderadores sí pueden ver).
  const isPrivateLocked = pubsError instanceof ApiError && pubsError.status === 403;
  const { data: creator } = useQuery({
    queryKey: ["user", community?.creator_id],
    queryFn: () => fetchUser(community!.creator_id),
    enabled: !!community?.creator_id,
  });
  const queryClient = useQueryClient();

  if (isLoading) return <p className="text-center text-muted-foreground py-10">Cargando…</p>;
  if (isError || !community) return <p className="text-center py-10">Comunidad no encontrada.</p>;

  const membership = community.membership ?? null;
  const isOwner = user?.id === community.creator_id;

  async function toggleJoin() {
    if (!user) return toast.error("Inicia sesión para unirte.");
    if (!community) return;
    if (community.privacy_level === "PRIVATE") return toast("Esta comunidad es por invitación.");
    try {
      if (membership === "active") {
        await leaveCommunity(community.id);
        toast.success(`Has salido de ${community.name}`);
      } else if (membership === "pending") {
        await leaveCommunity(community.id); // cancela la solicitud pendiente
        toast.success("Solicitud cancelada");
      } else {
        const { status } = await joinCommunity(community.id);
        toast.success(status === "active"
          ? `Te uniste a ${community.name}`
          : "Solicitud enviada, pendiente de aprobación");
      }
      await queryClient.invalidateQueries({ queryKey: ["community", id] });
      await queryClient.invalidateQueries({ queryKey: ["communities"] });
      await queryClient.invalidateQueries({ queryKey: ["members", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar la membresía");
    }
  }

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
        {community.cover_image ? (
          <img src={community.cover_image} alt="" className="h-32 w-full object-cover" />
        ) : (
          <div className="h-32 bg-gradient-to-r from-primary to-primary-hover" />
        )}
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
          <div className="flex flex-col gap-2">
            {!isOwner && (
              <Button
                onClick={toggleJoin}
                variant={membership ? "outline" : "default"}
                className="rounded-full"
              >
                {membership === "active" ? "Unido" : membership === "pending" ? "Pendiente…" : "Unirse"}
              </Button>
            )}
            {isOwner && (
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/communities/$id/edit" params={{ id: community.id }}>Editar</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid lg:grid-cols-[1fr_260px] gap-6">
        <div>
          <h2 className="font-display text-lg font-semibold mb-3">Publicaciones</h2>
          {isPrivateLocked ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Comunidad privada</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Su contenido solo es visible para miembros. El acceso es por invitación.
              </p>
            </div>
          ) : (
            <PublicationList items={pubs ?? []} />
          )}
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

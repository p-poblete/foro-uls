import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCommunity, fetchMembers, approveMember, removeMember } from "@/lib/api";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Search, UserMinus, Check, Crown } from "lucide-react";
import { toast } from "sonner";
import type { CommunityMembership } from "@/types";

export const Route = createFileRoute("/_app/communities/$id/members")({
  head: () => ({ meta: [{ title: "Miembros — Readuls" }] }),
  component: CommunityMembersPage,
});

function CommunityMembersPage() {
  const { id } = Route.useParams();
  const user = useAuth();
  const queryClient = useQueryClient();
  const { data: community, isLoading, isError } = useQuery({
    queryKey: ["community", id], queryFn: () => fetchCommunity(id),
  });
  // El backend incluye a los pendientes solo si quien consulta es el dueño.
  const { data: members } = useQuery({ queryKey: ["members", id], queryFn: () => fetchMembers(id) });
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (members ?? []).filter(
      (m) => !term || m.user?.username.toLowerCase().includes(term),
    );
  }, [members, q]);

  if (isLoading) return <p className="text-center text-muted-foreground py-10">Cargando…</p>;
  if (isError || !community) return <p className="text-center py-10">Comunidad no encontrada.</p>;
  const isOwner = user?.id === community.creator_id;
  const active = filtered.filter((m) => m.status === "active");
  const pending = filtered.filter((m) => m.status === "pending");

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["members", id] });
    await queryClient.invalidateQueries({ queryKey: ["community", id] });
  }

  async function approve(userId: string) {
    try {
      await approveMember(id, userId);
      toast.success("Solicitud aprobada");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo aprobar");
    }
  }

  async function kick(userId: string, isPending: boolean) {
    if (!isPending && !confirm("¿Expulsar a este miembro?")) return;
    try {
      await removeMember(id, userId);
      toast.success(isPending ? "Solicitud rechazada" : "Miembro expulsado");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo quitar al miembro");
    }
  }

  return (
    <div className="max-w-3xl mx-auto w-full">
      <FeedHeader
        title={`Miembros de ${community.name}`}
        subtitle={`${active.length} miembros${pending.length ? ` · ${pending.length} pendientes` : ""}`}
        action={
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/communities/$id" params={{ id: community.id }}>Volver</Link>
          </Button>
        }
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar miembro por usuario..."
          className="pl-9"
        />
      </div>

      {isOwner && pending.length > 0 && (
        <>
          <h2 className="text-sm font-semibold mb-2">Solicitudes pendientes</h2>
          <ul className="space-y-2 mb-6">
            {pending.map((m) => (
              <MemberRow key={m.user_id} m={m}>
                <Button size="sm" onClick={() => approve(m.user_id)}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Aprobar
                </Button>
                <Button size="sm" variant="outline" onClick={() => kick(m.user_id, true)}>
                  Rechazar
                </Button>
              </MemberRow>
            ))}
          </ul>
        </>
      )}

      <ul className="space-y-2">
        {active.map((m) => (
          <MemberRow key={m.user_id} m={m}>
            {isOwner && m.role !== "owner" && (
              <Button size="sm" variant="destructive" onClick={() => kick(m.user_id, false)}>
                <UserMinus className="h-3.5 w-3.5 mr-1" /> Expulsar
              </Button>
            )}
          </MemberRow>
        ))}
        {active.length === 0 && (
          <li className="text-center text-sm text-muted-foreground py-8">
            Aún no hay miembros. ¡Sé el primero en unirte!
          </li>
        )}
      </ul>
    </div>
  );
}

function MemberRow({ m, children }: { m: CommunityMembership; children?: React.ReactNode }) {
  return (
    <li className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
      <Avatar className="h-10 w-10">
        <AvatarImage src={m.user?.profile_image ?? undefined} />
        <AvatarFallback>{initials(m.user?.username ?? "?")}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link to="/users/$id" params={{ id: m.user_id }} className="font-medium text-sm hover:underline">
            @{m.user?.username}
          </Link>
          {m.role === "owner" && (
            <span className="text-[10px] rounded-full px-2 py-0.5 bg-primary/10 text-primary font-semibold flex items-center gap-1">
              <Crown className="h-3 w-3" />Propietario
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Se unió {timeAgo(m.joined_at)}</p>
      </div>
      <div className="flex gap-1">{children}</div>
    </li>
  );
}

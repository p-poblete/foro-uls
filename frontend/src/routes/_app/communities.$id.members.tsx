import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchCommunity, fetchUsers } from "@/lib/api";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Search, Shield, UserMinus, UserPlus, Crown } from "lucide-react";
import { toast } from "sonner";
import type { UserProfile } from "@/types";

export const Route = createFileRoute("/_app/communities/$id/members")({
  head: () => ({ meta: [{ title: "Miembros — Readuls" }] }),
  component: CommunityMembersPage,
});

interface Member {
  user_id: string;
  role: "OWNER" | "MOD" | "MEMBER";
  joined_at: string;
}

function CommunityMembersPage() {
  const { id } = Route.useParams();
  const user = useAuth();
  const { data: community, isLoading, isError } = useQuery({
    queryKey: ["community", id], queryFn: () => fetchCommunity(id),
  });
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  const [q, setQ] = useState("");
  const [members, setMembers] = useState<Member[]>([]);

  // ponytail: sin tabla de membresías todavía → los "miembros" son los usuarios
  // reales de la BD, con rol OWNER para el creador. Las acciones son locales.
  useEffect(() => {
    if (!community || !users) return;
    setMembers(users.map((u, i) => ({
      user_id: u.id,
      role: u.id === community.creator_id ? "OWNER" : (i === 1 ? "MOD" : "MEMBER"),
      joined_at: new Date(Date.now() - i * 86400000 * 30).toISOString(),
    })));
  }, [community, users]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const byId = new Map((users ?? []).map((u) => [u.id, u]));
    return members
      .map((m) => ({ ...m, user: byId.get(m.user_id) }))
      .filter((m): m is Member & { user: UserProfile } => !!m.user)
      .filter((m) => !term || m.user.username.toLowerCase().includes(term));
  }, [members, q, users]);

  if (isLoading) return <p className="text-center text-muted-foreground py-10">Cargando…</p>;
  if (isError || !community) return <p className="text-center py-10">Comunidad no encontrada.</p>;
  const isOwner = user?.id === community.creator_id;

  function promote(id: string) {
    setMembers((ms) => ms.map((m) => m.user_id === id ? { ...m, role: "MOD" } : m));
    toast.success("Usuario promovido a moderador");
  }
  function demote(id: string) {
    setMembers((ms) => ms.map((m) => m.user_id === id ? { ...m, role: "MEMBER" } : m));
    toast.success("Rol actualizado");
  }
  function kick(id: string) {
    if (!confirm("¿Expulsar a este miembro?")) return;
    setMembers((ms) => ms.filter((m) => m.user_id !== id));
    toast.success("Miembro expulsado");
  }

  return (
    <div className="max-w-3xl mx-auto w-full">
      <FeedHeader
        title={`Miembros de ${community.name}`}
        subtitle={`${members.length} miembros`}
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

      <ul className="space-y-2">
        {filtered.map((m) => (
          <li key={m.user_id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={m.user.profile_image ?? undefined} />
              <AvatarFallback>{initials(m.user.username)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link to="/users/$id" params={{ id: m.user.id }} className="font-medium text-sm hover:underline">
                  @{m.user.username}
                </Link>
                <RolePill role={m.role} />
              </div>
              <p className="text-xs text-muted-foreground">Se unió {timeAgo(m.joined_at)}</p>
            </div>
            {isOwner && m.role !== "OWNER" && (
              <div className="flex gap-1">
                {m.role === "MEMBER" ? (
                  <Button size="sm" variant="outline" onClick={() => promote(m.user_id)}>
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> Promover
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => demote(m.user_id)}>
                    <Shield className="h-3.5 w-3.5 mr-1" /> Quitar mod
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => kick(m.user_id)}>
                  <UserMinus className="h-3.5 w-3.5 mr-1" /> Expulsar
                </Button>
              </div>
            )}
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="text-center text-sm text-muted-foreground py-8">Sin resultados.</li>
        )}
      </ul>
    </div>
  );
}

function RolePill({ role }: { role: Member["role"] }) {
  if (role === "OWNER") {
    return <span className="text-[10px] rounded-full px-2 py-0.5 bg-primary/10 text-primary font-semibold flex items-center gap-1"><Crown className="h-3 w-3" />Propietario</span>;
  }
  if (role === "MOD") {
    return <span className="text-[10px] rounded-full px-2 py-0.5 bg-secondary text-secondary-foreground font-semibold flex items-center gap-1"><Shield className="h-3 w-3" />Moderador</span>;
  }
  return null;
}

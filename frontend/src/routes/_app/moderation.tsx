import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { REPORT_REASONS } from "@/constants";
import { requireAuth, isModerator, useAuth } from "@/lib/auth";
import { initials, timeAgo } from "@/lib/format";
import {
  Shield, Users, FileWarning, Check, X, ShieldOff, Search,
  Pencil, UserMinus, PlayCircle, PauseCircle, Archive, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchReports, resolveReport, fetchCommunities, updateCommunity,
  deleteCommunity, fetchUsers, deleteUser,
} from "@/lib/api";
import type { Report } from "@/types";

export const Route = createFileRoute("/_app/moderation")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Moderación — Readuls" }] }),
  component: ModerationPage,
});

function ModerationPage() {
  const queryClient = useQueryClient();
  const me = useAuth();
  // isModerator lee localStorage → solo en cliente (evita hydration mismatch en SSR).
  // El backend exige el rol `moderator` (Auth0 RBAC); el gate de UI solo evita un 403.
  const [moderator, setModerator] = useState(false);
  useEffect(() => setModerator(isModerator()), []);

  const { data: reports, isError } = useQuery({
    queryKey: ["reports"], queryFn: () => fetchReports(), enabled: moderator,
  });
  const { data: communities } = useQuery({
    queryKey: ["communities"], queryFn: fetchCommunities, enabled: moderator,
  });
  const { data: users } = useQuery({
    queryKey: ["users"], queryFn: fetchUsers, enabled: moderator,
  });
  const [qc, setQc] = useState("");
  const [qu, setQu] = useState("");

  const filteredCommunities = useMemo(() => {
    const t = qc.trim().toLowerCase();
    return (communities ?? []).filter((c) => !t || c.name.toLowerCase().includes(t));
  }, [communities, qc]);

  const filteredUsers = useMemo(() => {
    const t = qu.trim().toLowerCase();
    return (users ?? []).filter(
      (u) => !t || u.username.toLowerCase().includes(t) || u.email.toLowerCase().includes(t),
    );
  }, [users, qu]);

  if (!moderator) {
    return (
      <div className="max-w-xl mx-auto w-full text-center py-16">
        <ShieldOff className="h-10 w-10 mx-auto text-muted-foreground" />
        <h1 className="font-display text-xl font-semibold mt-4">Acceso restringido</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Este panel requiere el rol de moderador. Si crees que deberías tenerlo,
          contacta al administrador del foro.
        </p>
      </div>
    );
  }

  const pending = (reports ?? []).filter((r) => r.status === "PENDING");

  async function refresh(key: string) {
    await queryClient.invalidateQueries({ queryKey: [key] });
  }

  async function resolve(id: string, status: "REVIEWED" | "DISMISSED") {
    try {
      await resolveReport(id, status);
      toast.success(status === "REVIEWED" ? "Marcado como revisado" : "Reporte descartado");
      await refresh("reports");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar el reporte");
    }
  }

  async function toggleSuspend(id: string, name: string, suspended: boolean) {
    try {
      await updateCommunity(id, { status: suspended ? "active" : "suspended" });
      toast.success(suspended ? `"${name}" reactivada` : `"${name}" suspendida (no admite nuevos miembros)`);
      await refresh("communities");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    }
  }

  async function archiveCommunity(id: string, name: string) {
    if (!confirm(`¿Archivar la comunidad "${name}"? Dejará de ser visible.`)) return;
    try {
      await deleteCommunity(id);
      toast.success(`Comunidad "${name}" archivada`);
      await refresh("communities");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo archivar");
    }
  }

  async function deactivateUser(id: string, username: string) {
    if (!confirm(`¿Desactivar la cuenta @${username}? Dejará de aparecer en el foro.`)) return;
    try {
      await deleteUser(id);
      toast.success(`Cuenta @${username} desactivada`);
      await refresh("users");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo desactivar");
    }
  }

  return (
    <div className="max-w-4xl mx-auto w-full">
      <FeedHeader
        title="Panel de moderación"
        subtitle="Revisa reportes y gestiona comunidades y usuarios"
      />

      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports" className="gap-1.5">
            <FileWarning className="h-4 w-4" /> Reportes {pending.length > 0 && <span className="ml-1 rounded-full bg-destructive text-destructive-foreground text-[10px] px-1.5">{pending.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="communities" className="gap-1.5"><Shield className="h-4 w-4" />Comunidades</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-4 w-4" />Usuarios</TabsTrigger>
        </TabsList>

        {/* ---------- Reportes ---------- */}
        <TabsContent value="reports" className="mt-4">
          {isError ? (
            <EmptyState text="No se pudieron cargar los reportes (¿tu token tiene el rol moderator?)." />
          ) : (reports ?? []).length === 0 ? (
            <EmptyState text="No hay reportes por el momento." />
          ) : (
            <ul className="space-y-2">
              {(reports ?? []).map((r) => {
                const reasonLabel = REPORT_REASONS.find((x) => x.value === r.reason)?.label ?? r.reason;
                return (
                  <li key={r._id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {r.target_type}
                          </span>
                          <StatusPill status={r.status} />
                        </div>
                        <p className="text-sm mt-1 font-medium truncate">
                          {r.target_label ?? `${r.target_type} #${r.target_id}`}
                        </p>
                        {r.target_type === "publication" && (
                          <Link
                            to="/publications/$id" params={{ id: r.target_id }}
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                          >
                            Ver publicación <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Motivo: {reasonLabel} · {timeAgo(r.created_at)}
                        </p>
                        {r.detail && <p className="text-sm mt-2 text-foreground/80">{r.detail}</p>}
                      </div>
                      {r.status === "PENDING" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => resolve(r._id, "DISMISSED")}>
                            <X className="h-3.5 w-3.5 mr-1" /> Descartar
                          </Button>
                          <Button size="sm" onClick={() => resolve(r._id, "REVIEWED")}>
                            <Check className="h-3.5 w-3.5 mr-1" /> Resolver
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        {/* ---------- Comunidades ---------- */}
        <TabsContent value="communities" className="mt-4">
          <SearchBox value={qc} onChange={setQc} placeholder="Buscar comunidad..." />
          <ul className="space-y-2 mt-3">
            {filteredCommunities.map((c) => {
              const suspended = c.status === "suspended";
              return (
                <li key={c.id} className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link to="/communities/$id" params={{ id: c.id }} className="font-medium text-sm hover:underline">
                        {c.name}
                      </Link>
                      {suspended && (
                        <span className="text-[10px] rounded-full px-2 py-0.5 bg-destructive/15 text-destructive font-semibold">
                          Suspendida
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.member_count} miembros · {c.privacy_level}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/communities/$id/members" params={{ id: c.id }}>
                        <Users className="h-3.5 w-3.5 mr-1" /> Miembros
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/communities/$id/edit" params={{ id: c.id }}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleSuspend(c.id, c.name, suspended)}>
                      {suspended
                        ? <><PlayCircle className="h-3.5 w-3.5 mr-1" /> Reactivar</>
                        : <><PauseCircle className="h-3.5 w-3.5 mr-1" /> Suspender</>}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => archiveCommunity(c.id, c.name)}>
                      <Archive className="h-3.5 w-3.5 mr-1" /> Archivar
                    </Button>
                  </div>
                </li>
              );
            })}
            {filteredCommunities.length === 0 && (
              <li><EmptyState text="Sin comunidades que coincidan." /></li>
            )}
          </ul>
        </TabsContent>

        {/* ---------- Usuarios ---------- */}
        <TabsContent value="users" className="mt-4">
          <SearchBox value={qu} onChange={setQu} placeholder="Buscar por usuario o correo..." />
          <ul className="space-y-2 mt-3">
            {filteredUsers.map((u) => (
              <li key={u.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={u.profile_image ?? undefined} />
                  <AvatarFallback>{initials(u.username)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <Link to="/users/$id" params={{ id: u.id }} className="font-medium text-sm hover:underline">
                    @{u.username}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">{u.email} · Miembro {timeAgo(u.created_at)}</p>
                </div>
                {u.id !== me?.id && (
                  <Button size="sm" variant="destructive" onClick={() => deactivateUser(u.id, u.username)}>
                    <UserMinus className="h-3.5 w-3.5 mr-1" /> Desactivar
                  </Button>
                )}
              </li>
            ))}
            {filteredUsers.length === 0 && (
              <li><EmptyState text="Sin usuarios que coincidan." /></li>
            )}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
  );
}

function StatusPill({ status }: { status: Report["status"] }) {
  const map = {
    PENDING: "bg-[var(--color-label-help)]/15 text-[var(--color-label-help)]",
    REVIEWED: "bg-[var(--color-label-discussion)]/15 text-[var(--color-label-discussion)]",
    DISMISSED: "bg-muted text-muted-foreground",
  };
  const label = { PENDING: "Pendiente", REVIEWED: "Revisado", DISMISSED: "Descartado" };
  return <span className={`text-[10px] rounded-full px-2 py-0.5 font-semibold ${map[status]}`}>{label[status]}</span>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground text-sm">
      {text}
    </div>
  );
}

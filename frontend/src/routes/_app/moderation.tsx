import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { REPORT_REASONS } from "@/constants";
import { requireAuth, isModerator } from "@/lib/auth";
import { Shield, Users, FileWarning, Check, X, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchReports, resolveReport, fetchCommunities, updateCommunity, deleteCommunity } from "@/lib/api";
import type { Report } from "@/types";

export const Route = createFileRoute("/_app/moderation")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Moderación — Readuls" }] }),
  component: ModerationPage,
});

function ModerationPage() {
  const queryClient = useQueryClient();
  // isModerator lee localStorage → solo en cliente (evita hydration mismatch en SSR).
  // El backend exige el rol `moderator` (Auth0 RBAC) en estas rutas; el gate de
  // UI solo evita mostrar un panel que devolvería 403.
  const [moderator, setModerator] = useState(false);
  useEffect(() => setModerator(isModerator()), []);
  const { data: reports, isError } = useQuery({
    queryKey: ["reports"],
    queryFn: () => fetchReports(),
    enabled: moderator,
  });
  const { data: communities } = useQuery({
    queryKey: ["communities"], queryFn: fetchCommunities, enabled: moderator,
  });

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

  async function resolve(id: string, status: "REVIEWED" | "DISMISSED") {
    try {
      await resolveReport(id, status);
      toast.success(status === "REVIEWED" ? "Marcado como revisado" : "Reporte descartado");
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar el reporte");
    }
  }

  async function archiveCommunity(id: string, name: string) {
    if (!confirm(`¿Archivar la comunidad "${name}"? Dejará de ser visible.`)) return;
    try {
      await deleteCommunity(id);
      toast.success(`Comunidad "${name}" archivada`);
      await queryClient.invalidateQueries({ queryKey: ["communities"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo archivar");
    }
  }

  async function suspendCommunity(id: string, name: string) {
    try {
      await updateCommunity(id, { visibility: "private" });
      toast.success(`Comunidad "${name}" suspendida (privada)`);
      await queryClient.invalidateQueries({ queryKey: ["communities"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo suspender");
    }
  }

  return (
    <div className="max-w-4xl mx-auto w-full">
      <FeedHeader
        title="Panel de moderación"
        subtitle="Revisa reportes y gestiona comunidades"
      />

      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports" className="gap-1.5">
            <FileWarning className="h-4 w-4" /> Reportes {pending.length > 0 && <span className="ml-1 rounded-full bg-destructive text-destructive-foreground text-[10px] px-1.5">{pending.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="communities" className="gap-1.5"><Shield className="h-4 w-4" />Comunidades</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-4 w-4" />Usuarios</TabsTrigger>
        </TabsList>

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
                        <p className="text-xs text-muted-foreground mt-1">Motivo: {reasonLabel}</p>
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

        <TabsContent value="communities" className="mt-4">
          <ul className="space-y-2">
            {(communities ?? []).map((c) => (
              <li key={c.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.member_count} miembros · {c.privacy_level}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => suspendCommunity(c.id, c.name)}>Suspender</Button>
                  <Button size="sm" variant="destructive" onClick={() => archiveCommunity(c.id, c.name)}>Archivar</Button>
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <EmptyState text="Gestión de usuarios disponible próximamente." />
        </TabsContent>
      </Tabs>
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

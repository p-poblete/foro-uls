import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { STORAGE_KEYS, REPORT_REASONS } from "@/constants";
import { requireAuth } from "@/lib/auth";
import { Shield, Users, FileWarning, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { fetchFeed, fetchCommunities } from "@/lib/api";

interface ReportItem {
  id: string;
  target_type: string;
  target_id: string;
  target_label?: string;
  reason: string;
  detail: string;
  status: "PENDING" | "REVIEWED" | "DISMISSED";
  created_at: string;
}

export const Route = createFileRoute("/_app/moderation")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Moderación — Readuls" }] }),
  component: ModerationPage,
});

function ModerationPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const { data: feed } = useQuery({ queryKey: ["feed"], queryFn: () => fetchFeed() });
  const { data: communities } = useQuery({ queryKey: ["communities"], queryFn: fetchCommunities });

  useEffect(() => { load(); }, []);
  function load() {
    try { setReports(JSON.parse(localStorage.getItem(STORAGE_KEYS.reports) ?? "[]")); }
    catch { setReports([]); }
  }
  function updateStatus(id: string, status: ReportItem["status"]) {
    const next = reports.map((r) => r.id === id ? { ...r, status } : r);
    localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(next));
    setReports(next);
    toast.success(status === "REVIEWED" ? "Marcado como revisado" : "Reporte descartado");
  }

  const pending = reports.filter((r) => r.status === "PENDING");

  return (
    <div className="max-w-4xl mx-auto w-full">
      <FeedHeader
        title="Panel de moderación"
        subtitle="Revisa reportes, comunidades y usuarios"
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
          {reports.length === 0 ? (
            <EmptyState text="No hay reportes por el momento." />
          ) : (
            <ul className="space-y-2">
              {reports.map((r) => {
                const reasonLabel = REPORT_REASONS.find((x) => x.value === r.reason)?.label ?? r.reason;
                const pubTitle = r.target_type === "publication"
                  ? (feed ?? []).find((p) => p.id === r.target_id)?.title
                  : undefined;
                return (
                  <li key={r.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {r.target_type}
                          </span>
                          <StatusPill status={r.status} />
                        </div>
                        <p className="text-sm mt-1 font-medium truncate">
                          {r.target_label ?? pubTitle ?? r.target_id}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Motivo: {reasonLabel}</p>
                        {r.detail && <p className="text-sm mt-2 text-foreground/80">{r.detail}</p>}
                      </div>
                      {r.status === "PENDING" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "DISMISSED")}>
                            <X className="h-3.5 w-3.5 mr-1" /> Descartar
                          </Button>
                          <Button size="sm" onClick={() => updateStatus(r.id, "REVIEWED")}>
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
                  <Button size="sm" variant="outline">Suspender</Button>
                  <Button size="sm" variant="destructive">Archivar</Button>
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

function StatusPill({ status }: { status: ReportItem["status"] }) {
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

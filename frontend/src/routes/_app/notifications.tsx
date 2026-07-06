import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchNotifications } from "@/lib/api";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, timeAgo } from "@/lib/format";
import { NOTIFICATION_LABELS, STORAGE_KEYS } from "@/constants";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { requireAuth, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/notifications")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Notificaciones — Readuls" }] }),
  component: NotificationsPage,
});

function readIds(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.notifsRead) ?? "[]"); }
  catch { return []; }
}
function writeIds(ids: string[]) {
  localStorage.setItem(STORAGE_KEYS.notifsRead, JSON.stringify(ids));
  window.dispatchEvent(new Event("notifs-change"));
}

function NotificationsPage() {
  const user = useAuth();
  const { data: notifications } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user,
  });
  const notifs = notifications ?? [];
  const [readSet, setReadSet] = useState<Set<string>>(new Set());

  useEffect(() => { setReadSet(new Set(readIds())); }, []);

  function markAll() {
    const ids = notifs.map((n) => n._id);
    writeIds(ids);
    setReadSet(new Set(ids));
  }
  function markOne(id: string) {
    if (readSet.has(id)) return;
    const next = new Set(readSet); next.add(id);
    setReadSet(next);
    writeIds(Array.from(next));
  }

  return (
    <div className="max-w-2xl mx-auto w-full">
      <FeedHeader
        title="Notificaciones"
        subtitle="Actividad reciente en tu cuenta"
        action={<Button variant="outline" className="rounded-full" onClick={markAll}><Check className="h-4 w-4 mr-1" />Marcar todo</Button>}
      />
      {notifs.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
          No tienes notificaciones.
        </div>
      )}
      <ul className="space-y-2">
        {notifs.map((n) => {
          const isRead = n.is_read || readSet.has(n._id);
          return (
            <li
              key={n._id}
              onClick={() => markOne(n._id)}
              className={`cursor-pointer rounded-xl border p-4 flex items-start gap-3 transition-colors ${isRead ? "border-border bg-card" : "border-primary/30 bg-primary/5"}`}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={n.trigger_user?.profile_image ?? undefined} />
                <AvatarFallback>{initials(n.trigger_user?.username ?? "?")}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-semibold">@{n.trigger_user?.username}</span>{" "}
                  <span className="text-muted-foreground">{NOTIFICATION_LABELS[n.type].toLowerCase()}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
                {n.publication_id && (
                  <Link to="/publications/$id" params={{ id: n.publication_id }} className="text-xs text-primary hover:underline mt-1 inline-block">
                    Ver publicación
                  </Link>
                )}
              </div>
              {!isRead && <span className="h-2 w-2 rounded-full bg-primary mt-1" aria-hidden />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

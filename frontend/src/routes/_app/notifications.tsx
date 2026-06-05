import { createFileRoute, Link } from "@tanstack/react-router";
import { NOTIFICATIONS } from "@/lib/mock-data";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, timeAgo } from "@/lib/format";
import { NOTIFICATION_LABELS } from "@/constants";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({ meta: [{ title: "Notificaciones — Readuls" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const [items, setItems] = useState(NOTIFICATIONS);
  function markAll() { setItems(items.map((n) => ({ ...n, is_read: true }))); }

  return (
    <div className="max-w-2xl mx-auto w-full">
      <FeedHeader
        title="Notificaciones"
        subtitle="Actividad reciente en tu cuenta"
        action={<Button variant="outline" className="rounded-full" onClick={markAll}><Check className="h-4 w-4 mr-1" />Marcar todo</Button>}
      />
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n._id} className={`rounded-xl border p-4 flex items-start gap-3 ${n.is_read ? "border-border bg-card" : "border-primary/30 bg-primary/5"}`}>
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
            {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary mt-1" aria-hidden />}
          </li>
        ))}
      </ul>
    </div>
  );
}

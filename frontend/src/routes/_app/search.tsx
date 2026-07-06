import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { useQuery } from "@tanstack/react-query";
import { fetchFeed, fetchCommunities, fetchUsers } from "@/lib/api";
import type { Community, UserProfile } from "@/types";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { PublicationList } from "@/components/publications/PublicationList";

const searchSchema = z.object({ q: z.string().optional().default("") });

export const Route = createFileRoute("/_app/search")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Búsqueda — Readuls" }] }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const term = q.trim().toLowerCase();
  const { data: feed } = useQuery({ queryKey: ["feed"], queryFn: () => fetchFeed() });
  const { data: communities } = useQuery({ queryKey: ["communities"], queryFn: fetchCommunities });
  const { data: allUsers } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  const pubs = term ? (feed ?? []).filter((p) => p.title.toLowerCase().includes(term) || p.content_text?.toLowerCase().includes(term)) : [];
  const comms = term ? (communities ?? []).filter((c) => c.name.toLowerCase().includes(term) || c.description.toLowerCase().includes(term)) : [];
  const users = term ? (allUsers ?? []).filter((u) => u.username.toLowerCase().includes(term)) : [];

  return (
    <div className="max-w-3xl mx-auto w-full">
      <FeedHeader
        title={q ? `Resultados para "${q}"` : "Búsqueda"}
        subtitle={q ? `${pubs.length + comms.length + users.length} resultados encontrados` : "Escribe en la barra de búsqueda superior"}
      />
      {q && (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">Todo</TabsTrigger>
            <TabsTrigger value="pubs">Publicaciones ({pubs.length})</TabsTrigger>
            <TabsTrigger value="comms">Comunidades ({comms.length})</TabsTrigger>
            <TabsTrigger value="users">Usuarios ({users.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4 space-y-6">
            {users.length > 0 && <UsersGrid items={users} />}
            {comms.length > 0 && <CommsGrid items={comms} />}
            <PublicationList items={pubs} />
          </TabsContent>
          <TabsContent value="pubs" className="mt-4"><PublicationList items={pubs} /></TabsContent>
          <TabsContent value="comms" className="mt-4"><CommsGrid items={comms} /></TabsContent>
          <TabsContent value="users" className="mt-4"><UsersGrid items={users} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function CommsGrid({ items }: { items: Community[] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {items.map((c) => (
        <Link key={c.id} to="/communities/$id" params={{ id: c.id }} className="rounded-xl border border-border bg-card p-3 hover:border-primary/40">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10"><AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{initials(c.name)}</AvatarFallback></Avatar>
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{c.name}</div>
              <div className="text-xs text-muted-foreground line-clamp-1">{c.description}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function UsersGrid({ items }: { items: UserProfile[] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {items.map((u) => (
        <Link key={u.id} to="/users/$id" params={{ id: u.id }} className="rounded-xl border border-border bg-card p-3 hover:border-primary/40">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10"><AvatarImage src={u.profile_image ?? undefined} /><AvatarFallback>{initials(u.username)}</AvatarFallback></Avatar>
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">@{u.username}</div>
              <div className="text-xs text-muted-foreground">{u.email}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

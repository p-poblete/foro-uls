import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { COMMUNITIES, PUBLICATIONS, USERS } from "@/lib/mock-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, timeAgo } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PublicationList } from "@/components/publications/PublicationList";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/_app/users/$id")({
  loader: ({ params }) => {
    const u = USERS.find((x) => x.id === params.id);
    if (!u) throw notFound();
    return { user: u };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `@${loaderData?.user.username ?? "usuario"} — Readuls` }],
  }),
  errorComponent: ({ error }) => <p className="text-destructive">{error.message}</p>,
  notFoundComponent: () => <p>Usuario no encontrado.</p>,
  component: UserProfilePage,
});

function UserProfilePage() {
  const { user } = Route.useLoaderData();
  const pubs = PUBLICATIONS.filter((p) => p.author_id === user.id);
  const comms = COMMUNITIES.filter((c) => c.creator_id === user.id);

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
        <div className="h-32 bg-gradient-to-r from-primary to-primary-hover" />
        <div className="p-5 flex items-start gap-4">
          <Avatar className="h-24 w-24 -mt-16 border-4 border-card shadow">
            <AvatarImage src={user.profile_image ?? undefined} />
            <AvatarFallback className="text-2xl font-bold">{initials(user.username)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-semibold">@{user.username}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
              <Mail className="h-3.5 w-3.5" /> {user.email}
            </p>
            <p className="text-sm mt-2">
              {user.career?.name} · Se unió {timeAgo(user.created_at)}
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pubs" className="mt-6">
        <TabsList>
          <TabsTrigger value="pubs">Publicaciones ({pubs.length})</TabsTrigger>
          <TabsTrigger value="comms">Comunidades ({comms.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pubs" className="mt-4">
          <PublicationList items={pubs} />
        </TabsContent>
        <TabsContent value="comms" className="mt-4 grid sm:grid-cols-2 gap-3">
          {comms.map((c) => (
            <Link key={c.id} to="/communities/$id" params={{ id: c.id }} className="rounded-xl border border-border bg-card p-3 hover:border-primary/40">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10"><AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{initials(c.name)}</AvatarFallback></Avatar>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.member_count} miembros</div>
                </div>
              </div>
            </Link>
          ))}
          {comms.length === 0 && <p className="text-sm text-muted-foreground">Sin comunidades creadas.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

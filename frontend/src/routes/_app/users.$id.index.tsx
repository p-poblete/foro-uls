import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchUser, fetchFeed, fetchCommunities, fetchCareers, fetchUserComments } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, timeAgo } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PublicationList } from "@/components/publications/PublicationList";
import { Mail } from "lucide-react";
import { useBookmarks } from "@/lib/bookmarks";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import type { Comment } from "@/types";

export const Route = createFileRoute("/_app/users/$id/")({
  head: () => ({ meta: [{ title: "Perfil — Readuls" }] }),
  component: UserProfilePage,
});

function UserProfilePage() {
  const { id } = Route.useParams();
  const me = useAuth();
  const bookmarks = useBookmarks();
  const { data: user, isLoading, isError } = useQuery({ queryKey: ["user", id], queryFn: () => fetchUser(id) });
  const { data: feed } = useQuery({ queryKey: ["feed", me?.id], queryFn: () => fetchFeed(me?.id) });
  const { data: communities } = useQuery({ queryKey: ["communities"], queryFn: fetchCommunities });
  const { data: careers } = useQuery({ queryKey: ["careers"], queryFn: fetchCareers });
  const { data: comments } = useQuery({ queryKey: ["user-comments", id], queryFn: () => fetchUserComments(id) });

  if (isLoading) return <p className="text-center text-muted-foreground py-10">Cargando…</p>;
  if (isError || !user) return <p className="text-center py-10">Usuario no encontrado.</p>;

  const isMe = me?.id === user.id;
  const careerName = (careers ?? []).find((c) => c.id === user.career_id)?.name;
  const pubs = (feed ?? []).filter((p) => p.author_id === user.id);
  const comms = (communities ?? []).filter((c) => c.creator_id === user.id);
  const userComments: Comment[] = comments ?? [];
  const savedPubs = isMe ? (feed ?? []).filter((p) => bookmarks.ids.includes(p.id)) : [];

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
        <div className="h-32 bg-gradient-to-r from-primary to-primary-hover" />
        <div className="p-5 flex items-start gap-4 flex-wrap">
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
              {careerName ? `${careerName} · ` : ""}Se unió {timeAgo(user.created_at)}
            </p>
          </div>
          {isMe && (
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/users/$id/settings" params={{ id: user.id }}>Editar perfil</Link>
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="pubs" className="mt-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="pubs">Publicaciones ({pubs.length})</TabsTrigger>
          <TabsTrigger value="comments">Comentarios ({userComments.length})</TabsTrigger>
          {isMe && <TabsTrigger value="saved">Guardados ({savedPubs.length})</TabsTrigger>}
          <TabsTrigger value="comms">Comunidades ({comms.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pubs" className="mt-4">
          <PublicationList items={pubs} />
        </TabsContent>

        <TabsContent value="comments" className="mt-4 space-y-2">
          {userComments.length === 0 && <p className="text-sm text-muted-foreground">Sin comentarios.</p>}
          {userComments.map((c) => (
            <Link
              key={c._id}
              to="/publications/$id"
              params={{ id: c.publication_id }}
              className="block rounded-xl border border-border bg-card p-3 hover:border-primary/40"
            >
              <p className="text-sm line-clamp-3">{c.content_text}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {timeAgo(c.created_at)} · {c.like_count} likes
              </p>
            </Link>
          ))}
        </TabsContent>

        {isMe && (
          <TabsContent value="saved" className="mt-4">
            <PublicationList items={savedPubs} />
          </TabsContent>
        )}

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

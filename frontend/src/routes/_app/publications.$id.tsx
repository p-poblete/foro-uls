import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { COMMENTS, PUBLICATIONS } from "@/lib/mock-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, timeAgo, compactNumber } from "@/lib/format";
import { LabelBadge } from "@/components/publications/LabelBadge";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, MessageCircle, Share2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import type { Comment } from "@/types";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/publications/$id")({
  loader: ({ params }) => {
    const pub = PUBLICATIONS.find((p) => p.id === params.id);
    if (!pub) throw notFound();
    return { pub, comments: COMMENTS[pub.id] ?? [] };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.pub.title ?? "Publicación"} — Readuls` },
      { name: "description", content: loaderData?.pub.content_text ?? loaderData?.pub.title ?? "" },
      { property: "og:image", content: loaderData?.pub.multimedia[0] ?? "" },
    ],
  }),
  errorComponent: ({ error }) => <p className="text-destructive">{error.message}</p>,
  notFoundComponent: () => <p>Publicación no encontrada.</p>,
  component: PublicationPage,
});

function PublicationPage() {
  const { pub, comments: initial } = Route.useLoaderData();
  const user = useAuth();
  const [comments, setComments] = useState<Comment[]>(initial);
  const [text, setText] = useState("");

  function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return toast.error("Inicia sesión para comentar.");
    if (!text.trim()) return;
    const c: Comment = {
      _id: `tmp-${Date.now()}`,
      publication_id: pub.id,
      author_id: user.id,
      content_text: text,
      created_at: new Date().toISOString(),
      like_count: 0,
      dislike_count: 0,
      parent_comment_id: null,
      author: user,
      replies: [],
    };
    setComments([c, ...comments]);
    setText("");
    toast.success("Comentario publicado");
  }

  return (
    <div className="max-w-3xl mx-auto w-full">
      <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/communities/$id" params={{ id: pub.community_id }}>
            <Avatar className="h-10 w-10">
              <AvatarImage src={pub.community?.profile_image ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{initials(pub.community?.name ?? "C")}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="text-sm">
            <Link to="/communities/$id" params={{ id: pub.community_id }} className="font-semibold hover:text-primary">
              {pub.community?.name}
            </Link>
            <div className="text-xs text-muted-foreground">
              <Link to="/users/$id" params={{ id: pub.author_id }} className="hover:underline">{pub.author?.username}</Link>
              <span className="mx-1">·</span>{timeAgo(pub.created_at)}
            </div>
          </div>
        </div>

        <h1 className="font-display text-3xl font-semibold mt-4">{pub.title}</h1>
        {pub.label && <div className="mt-2"><LabelBadge label={pub.label} /></div>}
        {pub.content_text && <p className="mt-4 text-foreground/90 whitespace-pre-wrap">{pub.content_text}</p>}
        {pub.external_link && (
          <a href={pub.external_link} className="mt-3 inline-block text-sm text-primary underline" target="_blank" rel="noreferrer">
            {pub.external_link}
          </a>
        )}
        {pub.multimedia[0] && (
          <img src={pub.multimedia[0]} alt="" className="mt-4 rounded-lg border border-border max-h-[28rem] w-full object-cover" />
        )}

        <div className="flex items-center gap-2 mt-5">
          <div className="flex items-center rounded-full bg-primary text-primary-foreground">
            <button className="h-9 w-9 flex items-center justify-center hover:bg-primary-hover rounded-l-full"><ArrowUp className="h-4 w-4" /></button>
            <span className="px-2 text-sm font-semibold tabular-nums">{compactNumber(pub.like_count - pub.dislike_count)}</span>
            <button className="h-9 w-9 flex items-center justify-center hover:bg-primary-hover rounded-r-full"><ArrowDown className="h-4 w-4" /></button>
          </div>
          <Button className="rounded-full h-9 gap-2"><MessageCircle className="h-4 w-4" />{compactNumber(pub.comment_count)}</Button>
          <Button className="rounded-full h-9 gap-2" onClick={() => { navigator.clipboard?.writeText(location.href); toast.success("Enlace copiado"); }}><Share2 className="h-4 w-4" />Compartir</Button>
        </div>
      </article>

      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold mb-3">Comentarios</h2>
        <form onSubmit={submitComment} className="rounded-xl border border-border bg-card p-4 mb-4">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={user ? "Escribe un comentario..." : "Inicia sesión para comentar"} disabled={!user} />
          <div className="flex justify-end mt-2">
            <Button type="submit" className="rounded-full" disabled={!user || !text.trim()}>Comentar</Button>
          </div>
        </form>

        <div className="space-y-3">
          {comments.length === 0 && <p className="text-sm text-muted-foreground">Sé el primero en comentar.</p>}
          {comments.map((c) => <CommentNode key={c._id} c={c} depth={0} />)}
        </div>
      </section>
    </div>
  );
}

function CommentNode({ c, depth }: { c: Comment; depth: number }) {
  return (
    <div className={depth > 0 ? "ml-6 border-l border-border pl-4" : ""}>
      <div className="rounded-lg bg-card border border-border p-3">
        <div className="flex items-center gap-2 text-xs">
          <Avatar className="h-6 w-6"><AvatarImage src={c.author?.profile_image ?? undefined} /><AvatarFallback className="text-[10px]">{initials(c.author?.username ?? "?")}</AvatarFallback></Avatar>
          <span className="font-semibold">{c.author?.username}</span>
          <span className="text-muted-foreground">· {timeAgo(c.created_at)}</span>
        </div>
        <p className="text-sm mt-2 whitespace-pre-wrap">{c.content_text}</p>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <button className="hover:text-primary flex items-center gap-1"><ArrowUp className="h-3 w-3" /> {c.like_count}</button>
          <button className="hover:text-primary flex items-center gap-1"><ArrowDown className="h-3 w-3" /> {c.dislike_count}</button>
          <button className="hover:text-primary">Responder</button>
        </div>
      </div>
      {c.replies?.length > 0 && (
        <div className="mt-2 space-y-2">
          {c.replies.map((r) => <CommentNode key={r._id} c={r} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

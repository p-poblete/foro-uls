import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPost, fetchComments, createComment, votePost, voteComment, updateComment as apiUpdateComment, deleteComment as apiDeleteComment } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, timeAgo, compactNumber } from "@/lib/format";
import { LabelBadge } from "@/components/publications/LabelBadge";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, Flag, MessageCircle, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import type { Comment } from "@/types";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportDialog } from "@/components/publications/ReportDialog";
import { ImageUpload } from "@/components/ImageUpload";

export const Route = createFileRoute("/_app/publications/$id/")({
  head: () => ({ meta: [{ title: "Publicación — Readuls" }] }),
  component: PublicationPage,
});

function PublicationPage() {
  const { id } = Route.useParams();
  const user = useAuth();
  const queryClient = useQueryClient();
  const { data: pub, isLoading, isError } = useQuery({
    queryKey: ["post", id, user?.id],
    queryFn: () => fetchPost(id, user?.id),
  });
  const { data: commentsData } = useQuery({
    queryKey: ["comments", id],
    queryFn: () => fetchComments(id),
  });
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [commentImg, setCommentImg] = useState<string | null>(null);
  const [reaction, setReaction] = useState<"LIKE" | "DISLIKE" | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => { if (commentsData) setComments(commentsData); }, [commentsData]);
  useEffect(() => { if (pub) { setScore(pub.like_count - pub.dislike_count); setReaction(pub.user_reaction ?? null); } }, [pub]);

  if (isLoading) return <p className="text-center text-muted-foreground py-10">Cargando…</p>;
  if (isError || !pub) return <p className="text-center py-10">Publicación no encontrada.</p>;

  // Response-driven: el backend (toggle, un voto por usuario) es la fuente de verdad.
  async function reactPost(type: "LIKE" | "DISLIKE") {
    if (!user) return toast.error("Inicia sesión para reaccionar.");
    const prevScore = score, prevReaction = reaction;
    const delta = type === "LIKE" ? 1 : -1;
    const currentContrib = reaction === "LIKE" ? 1 : reaction === "DISLIKE" ? -1 : 0;
    if (reaction === type) { setReaction(null); setScore((s) => s - delta); }      // toggle off
    else { setReaction(type); setScore((s) => s - currentContrib + delta); }        // vota/cambia
    try {
      const res = await votePost(id, user.id, delta);
      setScore(res.vote_score);
      setReaction(res.user_vote === 1 ? "LIKE" : res.user_vote === -1 ? "DISLIKE" : null);
    } catch {
      setScore(prevScore); setReaction(prevReaction);
      toast.error("No se pudo registrar el voto.");
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return toast.error("Inicia sesión para comentar.");
    if (!text.trim()) return;
    try {
      await createComment(id, user.id, text, undefined, commentImg);
      await queryClient.invalidateQueries({ queryKey: ["comments", id] });
      setText("");
      setCommentImg(null);
      toast.success("Comentario publicado");
    } catch {
      toast.error("No se pudo publicar el comentario");
    }
  }

  async function addReply(parentId: string, content: string) {
    if (!user) return;
    try {
      await createComment(id, user.id, content, parentId);
      await queryClient.invalidateQueries({ queryKey: ["comments", id] });
      toast.success("Respuesta publicada");
    } catch {
      toast.error("No se pudo responder");
    }
  }

  async function editComment(cid: string, content: string) {
    setComments((cs) => updateComment(cs, cid, content)); // optimista
    try {
      await apiUpdateComment(cid, content);
      await queryClient.invalidateQueries({ queryKey: ["comments", id] });
      toast.success("Comentario editado");
    } catch {
      toast.error("No se pudo editar el comentario");
    }
  }

  async function deleteComment(cid: string) {
    if (!confirm("¿Eliminar este comentario?")) return;
    setComments((cs) => removeComment(cs, cid)); // optimista
    try {
      await apiDeleteComment(cid);
      await queryClient.invalidateQueries({ queryKey: ["comments", id] });
      toast.success("Comentario eliminado");
    } catch {
      toast.error("No se pudo eliminar el comentario");
    }
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
          <div className="text-sm flex-1">
            <Link to="/communities/$id" params={{ id: pub.community_id }} className="font-semibold hover:text-primary">
              {pub.community?.name}
            </Link>
            <div className="text-xs text-muted-foreground">
              <Link to="/users/$id" params={{ id: pub.author_id }} className="hover:underline">{pub.author?.username}</Link>
              <span className="mx-1">·</span>{timeAgo(pub.created_at)}
            </div>
          </div>
          {user?.id === pub.author_id && (
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/publications/$id/edit" params={{ id: pub.id }}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Link>
            </Button>
          )}
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

        <div className="flex items-center gap-2 mt-5 flex-wrap">
          <div className="flex items-center rounded-full border border-border bg-card overflow-hidden">
            <button
              onClick={() => reactPost("LIKE")}
              aria-label="Voto positivo"
              aria-pressed={reaction === "LIKE"}
              className={`h-9 w-10 flex items-center justify-center transition ${reaction === "LIKE" ? "bg-emerald-600 text-white" : "text-muted-foreground hover:bg-emerald-600/10 hover:text-emerald-600"}`}
            >
              <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
            </button>
            <span className={`px-2.5 text-sm font-bold tabular-nums ${reaction === "LIKE" ? "text-emerald-600" : reaction === "DISLIKE" ? "text-red-600" : ""}`}>
              {compactNumber(score)}
            </span>
            <button
              onClick={() => reactPost("DISLIKE")}
              aria-label="Voto negativo"
              aria-pressed={reaction === "DISLIKE"}
              className={`h-9 w-10 flex items-center justify-center transition ${reaction === "DISLIKE" ? "bg-red-600 text-white" : "text-muted-foreground hover:bg-red-600/10 hover:text-red-600"}`}
            >
              <ArrowDown className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>
          <Button className="rounded-full h-9 gap-2"><MessageCircle className="h-4 w-4" />{compactNumber(pub.comment_count)}</Button>
          <Button variant="outline" className="rounded-full h-9 gap-2" onClick={() => { navigator.clipboard?.writeText(location.href); toast.success("Enlace copiado"); }}><Share2 className="h-4 w-4" />Compartir</Button>
        </div>
      </article>

      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold mb-3">Comentarios</h2>
        <form onSubmit={submitComment} className="rounded-xl border border-border bg-card p-4 mb-4">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={user ? "Escribe un comentario..." : "Inicia sesión para comentar"} disabled={!user} />
          {user && (
            <div className="mt-2">
              <ImageUpload prefix="comments" value={commentImg} onChange={setCommentImg} />
            </div>
          )}
          <div className="flex justify-end mt-2">
            <Button type="submit" className="rounded-full" disabled={!user || !text.trim()}>Comentar</Button>
          </div>
        </form>

        <div className="space-y-3">
          {comments.length === 0 && <p className="text-sm text-muted-foreground">Sé el primero en comentar.</p>}
          {comments.map((c) => (
            <CommentNode
              key={c._id}
              c={c}
              depth={0}
              currentUserId={user?.id}
              onReply={addReply}
              onEdit={editComment}
              onDelete={deleteComment}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function updateComment(list: Comment[], id: string, content: string): Comment[] {
  return list.map((c) => {
    if (c._id === id) return { ...c, content_text: content };
    if (c.replies?.length) return { ...c, replies: updateComment(c.replies, id, content) };
    return c;
  });
}
function removeComment(list: Comment[], id: string): Comment[] {
  return list
    .filter((c) => c._id !== id)
    .map((c) => c.replies?.length ? { ...c, replies: removeComment(c.replies, id) } : c);
}

interface NodeProps {
  c: Comment;
  depth: number;
  currentUserId?: string;
  onReply: (parentId: string, content: string) => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}

function CommentNode({ c, depth, currentUserId, onReply, onEdit, onDelete }: NodeProps) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(c.content_text);
  const [reportOpen, setReportOpen] = useState(false);
  const [reaction, setReaction] = useState<"LIKE" | "DISLIKE" | null>(c.user_reaction ?? null);
  const [likes, setLikes] = useState(c.like_count);
  const [dislikes, setDislikes] = useState(c.dislike_count);
  const isOwner = currentUserId === c.author_id;

  function react(type: "LIKE" | "DISLIKE") {
    if (!currentUserId) return toast.error("Inicia sesión para reaccionar.");
    if (reaction === type) {
      setReaction(null);
      type === "LIKE" ? setLikes(likes - 1) : setDislikes(dislikes - 1);
    } else {
      if (reaction === "LIKE") setLikes(likes - 1);
      if (reaction === "DISLIKE") setDislikes(dislikes - 1);
      setReaction(type);
      type === "LIKE" ? setLikes(likes + 1) : setDislikes(dislikes + 1);
    }
    voteComment(c._id, type === "LIKE" ? 1 : -1).catch(() => {});
  }

  return (
    <div className={depth > 0 ? "ml-6 border-l border-border pl-4" : ""}>
      <div className="rounded-lg bg-card border border-border p-3">
        <div className="flex items-center gap-2 text-xs">
          <Avatar className="h-6 w-6">
            <AvatarImage src={c.author?.profile_image ?? undefined} />
            <AvatarFallback className="text-[10px]">{initials(c.author?.username ?? "?")}</AvatarFallback>
          </Avatar>
          <Link to="/users/$id" params={{ id: c.author_id }} className="font-semibold hover:underline">
            {c.author?.username}
          </Link>
          <span className="text-muted-foreground">· {timeAgo(c.created_at)}</span>
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded p-1 hover:bg-accent" aria-label="Opciones">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isOwner ? (
                  <>
                    <DropdownMenuItem onClick={() => { setEditing(true); setEditText(c.content_text); }}>
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(c._id)}>
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onClick={() => setReportOpen(true)}>
                    <Flag className="mr-2 h-3.5 w-3.5" /> Reportar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {editing ? (
          <div className="mt-2 space-y-2">
            <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button size="sm" onClick={() => {
                if (!editText.trim()) return;
                onEdit(c._id, editText);
                setEditing(false);
              }}>Guardar</Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm mt-2 whitespace-pre-wrap">{c.content_text}</p>
            {c.image_url && (
              <img src={c.image_url} alt="" className="mt-2 max-h-72 rounded-lg border object-cover" />
            )}
          </>
        )}

        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <button onClick={() => react("LIKE")} className={`hover:text-primary flex items-center gap-1 ${reaction === "LIKE" ? "text-primary font-semibold" : ""}`}>
            <ArrowUp className="h-3 w-3" /> {likes}
          </button>
          <button onClick={() => react("DISLIKE")} className={`hover:text-primary flex items-center gap-1 ${reaction === "DISLIKE" ? "text-primary font-semibold" : ""}`}>
            <ArrowDown className="h-3 w-3" /> {dislikes}
          </button>
          {currentUserId && (
            <button onClick={() => setReplying((v) => !v)} className="hover:text-primary">
              Responder
            </button>
          )}
        </div>

        {replying && (
          <div className="mt-3 space-y-2">
            <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={2} placeholder={`Responder a @${c.author?.username}...`} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => { setReplying(false); setReplyText(""); }}>Cancelar</Button>
              <Button size="sm" onClick={() => {
                if (!replyText.trim()) return;
                onReply(c._id, replyText);
                setReplyText("");
                setReplying(false);
              }}>Publicar</Button>
            </div>
          </div>
        )}
      </div>

      {c.replies?.length > 0 && (
        <div className="mt-2 space-y-2">
          {c.replies.map((r) => (
            <CommentNode
              key={r._id}
              c={r}
              depth={depth + 1}
              currentUserId={currentUserId}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="comment"
        targetId={c._id}
        targetLabel={c.content_text.slice(0, 60)}
      />
    </div>
  );
}

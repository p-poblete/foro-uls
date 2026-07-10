import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Bookmark, Flag, MessageCircle, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import type { Publication } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { compactNumber, initials, timeAgo } from "@/lib/format";
import { LabelBadge } from "@/components/publications/LabelBadge";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useBookmarks } from "@/lib/bookmarks";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { votePost, deletePost } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ReportDialog } from "@/components/publications/ReportDialog";

export function PublicationCard({ pub, onDelete }: { pub: Publication; onDelete?: (id: string) => void }) {
  const [reaction, setReaction] = useState<"LIKE" | "DISLIKE" | null>(pub.user_reaction ?? null);
  const [score, setScore] = useState(pub.like_count - pub.dislike_count);
  const bookmarks = useBookmarks();
  const user = useAuth();
  const queryClient = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);
  const saved = bookmarks.has(pub.id);
  const isOwner = user?.id === pub.author_id;

  // Sincroniza con el servidor cuando el feed se refresca (trae user_reaction real).
  useEffect(() => {
    setReaction(pub.user_reaction ?? null);
    setScore(pub.like_count - pub.dislike_count);
  }, [pub.id, pub.user_reaction, pub.like_count, pub.dislike_count]);

  // Response-driven: el backend (toggle, un voto por usuario) es la fuente de verdad.
  async function react(type: "LIKE" | "DISLIKE") {
    if (!user) return toast.error("Inicia sesión para reaccionar.");
    const prevScore = score, prevReaction = reaction;
    const delta = type === "LIKE" ? 1 : -1;
    const currentContrib = reaction === "LIKE" ? 1 : reaction === "DISLIKE" ? -1 : 0;
    if (reaction === type) { setReaction(null); setScore((s) => s - delta); }     // toggle off
    else { setReaction(type); setScore((s) => s - currentContrib + delta); }       // vota/cambia
    try {
      const res = await votePost(pub.id, user.id, delta);
      setScore(res.vote_score);
      setReaction(res.user_vote === 1 ? "LIKE" : res.user_vote === -1 ? "DISLIKE" : null);
    } catch {
      setScore(prevScore); setReaction(prevReaction);
      toast.error("No se pudo registrar el voto.");
    }
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar esta publicación?")) return;
    try {
      if (onDelete) {
        onDelete(pub.id);
      } else {
        await deletePost(pub.id);
        await queryClient.invalidateQueries({ queryKey: ["feed"] });
      }
      toast.success("Publicación eliminada");
    } catch {
      toast.error("No se pudo eliminar la publicación");
    }
  }

  function share() {
    navigator.clipboard?.writeText(`${location.origin}/publications/${pub.id}`).catch(() => {});
    toast.success("Enlace copiado al portapapeles");
  }

  function toggleBookmark() {
    if (!user) return toast.error("Inicia sesión para guardar.");
    bookmarks.toggle(pub.id);
    toast.success(saved ? "Quitado de guardados" : "Guardado");
  }

  return (
    <article className="rounded-xl border border-border bg-card shadow-sm overflow-hidden transition hover:border-primary/30">
      <div className="flex items-center gap-3 px-5 pt-4">
        <Link to="/communities/$id" params={{ id: pub.community_id }}>
          <Avatar className="h-9 w-9">
            <AvatarImage src={pub.community?.profile_image ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
              {initials(pub.community?.name ?? "C")}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="text-sm leading-tight flex-1 min-w-0">
          <Link to="/communities/$id" params={{ id: pub.community_id }} className="font-semibold hover:text-primary">
            {pub.community?.name}
          </Link>
          <div className="text-xs text-muted-foreground">
            <Link to="/users/$id" params={{ id: pub.author_id }} className="hover:underline">
              {pub.author?.username}
            </Link>
            <span className="mx-1">·</span>
            {timeAgo(pub.created_at)}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-md p-1.5 hover:bg-accent" aria-label="Más opciones">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={toggleBookmark}>
              <Bookmark className="mr-2 h-4 w-4" /> {saved ? "Quitar de guardados" : "Guardar"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={share}>
              <Share2 className="mr-2 h-4 w-4" /> Copiar enlace
            </DropdownMenuItem>
            {isOwner ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/publications/$id/edit" params={{ id: pub.id }}>
                    <Pencil className="mr-2 h-4 w-4" /> Editar
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setReportOpen(true)}>
                  <Flag className="mr-2 h-4 w-4" /> Reportar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Link to="/publications/$id" params={{ id: pub.id }} className="block px-5 pt-3">
        <h3 className="font-display text-xl md:text-2xl font-semibold leading-snug">
          {pub.title}
        </h3>
        {pub.label && <div className="mt-2"><LabelBadge label={pub.label} /></div>}
        {pub.content_text && (
          <p className="mt-3 text-sm text-foreground/80 line-clamp-3 whitespace-pre-wrap">
            {pub.content_text}
          </p>
        )}
      </Link>

      {pub.multimedia.length > 0 && (
        <div className="px-5 pt-4">
          <div className="overflow-hidden rounded-lg border border-border bg-muted">
            {/* lazy: la imagen solo se descarga cuando la card se acerca al viewport */}
            <img src={pub.multimedia[0]} alt={pub.title} loading="lazy" decoding="async" className="w-full max-h-96 object-cover" />
          </div>
        </div>
      )}

      {pub.tags.length > 0 && (
        <div className="px-5 pt-3 flex flex-wrap gap-1.5">
          {pub.tags.map((t) => (
            <span key={t} className="text-[11px] rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 px-5 py-4 mt-2 flex-wrap">
        <div className="flex items-center rounded-full border border-border bg-card overflow-hidden">
          <button
            onClick={() => react("LIKE")}
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
            onClick={() => react("DISLIKE")}
            aria-label="Voto negativo"
            aria-pressed={reaction === "DISLIKE"}
            className={`h-9 w-10 flex items-center justify-center transition ${reaction === "DISLIKE" ? "bg-red-600 text-white" : "text-muted-foreground hover:bg-red-600/10 hover:text-red-600"}`}
          >
            <ArrowDown className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        <Button asChild variant="default" className="rounded-full h-9 gap-2">
          <Link to="/publications/$id" params={{ id: pub.id }}>
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm font-semibold">{compactNumber(pub.comment_count)}</span>
          </Link>
        </Button>

        <Button
          onClick={toggleBookmark}
          variant={saved ? "default" : "outline"}
          className="rounded-full h-9 gap-2"
        >
          <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
          <span className="hidden sm:inline">{saved ? "Guardado" : "Guardar"}</span>
        </Button>

        <Button onClick={share} variant="outline" className="rounded-full h-9 gap-2">
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Compartir</span>
        </Button>
      </div>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="publication"
        targetId={pub.id}
        targetLabel={pub.title}
      />
    </article>
  );
}

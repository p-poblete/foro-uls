import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, MessageCircle, Share2 } from "lucide-react";
import type { Publication } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { compactNumber, initials, timeAgo } from "@/lib/format";
import { LabelBadge } from "@/components/publications/LabelBadge";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PublicationCard({ pub }: { pub: Publication }) {
  const [reaction, setReaction] = useState<"LIKE" | "DISLIKE" | null>(pub.user_reaction ?? null);
  const [likes, setLikes] = useState(pub.like_count);
  const [dislikes, setDislikes] = useState(pub.dislike_count);

  function react(type: "LIKE" | "DISLIKE") {
    if (reaction === type) {
      setReaction(null);
      type === "LIKE" ? setLikes(likes - 1) : setDislikes(dislikes - 1);
    } else {
      if (reaction === "LIKE") setLikes(likes - 1);
      if (reaction === "DISLIKE") setDislikes(dislikes - 1);
      setReaction(type);
      type === "LIKE" ? setLikes(likes + 1) : setDislikes(dislikes + 1);
    }
  }

  function share() {
    navigator.clipboard?.writeText(`${location.origin}/publications/${pub.id}`).catch(() => {});
    toast.success("Enlace copiado al portapapeles");
  }

  return (
    <article className="rounded-xl border border-border bg-card shadow-sm overflow-hidden transition hover:border-primary/30">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-4">
        <Link to="/communities/$id" params={{ id: pub.community_id }}>
          <Avatar className="h-9 w-9">
            <AvatarImage src={pub.community?.profile_image ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
              {initials(pub.community?.name ?? "C")}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="text-sm leading-tight">
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
      </div>

      {/* Body */}
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

      {/* Media */}
      {pub.multimedia.length > 0 && (
        <div className="px-5 pt-4">
          <div className="overflow-hidden rounded-lg border border-border bg-muted">
            <img src={pub.multimedia[0]} alt={pub.title} className="w-full max-h-96 object-cover" />
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

      {/* Actions */}
      <div className="flex items-center gap-2 px-5 py-4 mt-2">
        <div className="flex items-center rounded-full bg-primary text-primary-foreground">
          <button
            onClick={() => react("LIKE")}
            aria-label="Like"
            className={`h-9 w-9 rounded-l-full flex items-center justify-center hover:bg-primary-hover transition ${reaction === "LIKE" ? "bg-primary-hover" : ""}`}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <span className="px-2 text-sm font-semibold tabular-nums">
            {compactNumber(likes - dislikes)}
          </span>
          <button
            onClick={() => react("DISLIKE")}
            aria-label="Dislike"
            className={`h-9 w-9 rounded-r-full flex items-center justify-center hover:bg-primary-hover transition ${reaction === "DISLIKE" ? "bg-primary-hover" : ""}`}
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>

        <Button asChild variant="default" className="rounded-full h-9 gap-2">
          <Link to="/publications/$id" params={{ id: pub.id }}>
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm font-semibold">{compactNumber(pub.comment_count)}</span>
          </Link>
        </Button>

        <Button onClick={share} variant="default" className="rounded-full h-9 gap-2">
          <Share2 className="h-4 w-4" />
          Compartir
        </Button>
      </div>
    </article>
  );
}

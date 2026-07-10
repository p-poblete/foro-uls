import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPost, updatePost } from "@/lib/api";
import { PublicationComposer } from "@/components/publications/PublicationComposer";
import { requireAuth, useAuth, isModerator } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/publications/$id/edit")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Editar publicación — Readuls" }] }),
  component: EditPage,
});

function EditPage() {
  const { id } = Route.useParams();
  const user = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: pub, isLoading, isError } = useQuery({ queryKey: ["post", id], queryFn: () => fetchPost(id) });

  if (isLoading) return <p className="text-center text-muted-foreground py-10">Cargando…</p>;
  if (isError || !pub) return <p className="text-center py-10">Publicación no encontrada.</p>;

  // El backend permite editar al autor o a un moderador (avisa al autor si edita un mod).
  if (user && user.id !== pub.author_id && !isModerator()) {
    return <p className="text-sm text-destructive">No tienes permiso para editar esta publicación.</p>;
  }

  return (
    <PublicationComposer
      open={true}
      onOpenChange={(v) => { if (!v) navigate({ to: "/publications/$id", params: { id: pub.id } }); }}
      mode="edit"
      initial={{
        id: pub.id,
        title: pub.title,
        content: pub.content_text ?? "",
        community_id: pub.community_id,
        label: pub.label,
        tags: pub.tags.join(", "),
        external_link: pub.external_link ?? "",
        image_url: pub.multimedia[0] ?? "",
      }}
      onSubmit={async (draft) => {
        try {
          await updatePost(pub.id, { title: draft.title, content: draft.content, label: draft.label, image_url: draft.image_url || null });
          await queryClient.invalidateQueries({ queryKey: ["post", pub.id] });
          await queryClient.invalidateQueries({ queryKey: ["feed"] });
          navigate({ to: "/publications/$id", params: { id: pub.id } });
        } catch {
          toast.error("No se pudieron guardar los cambios");
        }
      }}
    />
  );
}

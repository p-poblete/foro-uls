import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCommunity, updateCommunity } from "@/lib/api";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "@/components/ImageUpload";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { requireAuth, useAuth, isModerator } from "@/lib/auth";

export const Route = createFileRoute("/_app/communities/$id/edit")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Editar comunidad — Readuls" }] }),
  component: EditCommunityPage,
});

const VISIBILITY = [
  { value: "public", label: "Pública" },
  { value: "restricted", label: "Restringida" },
  { value: "private", label: "Privada" },
];

function EditCommunityPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const user = useAuth();
  const queryClient = useQueryClient();
  const { data: community, isLoading, isError } = useQuery({
    queryKey: ["community", id],
    queryFn: () => fetchCommunity(id),
  });

  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [image, setImage] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!community) return;
    setDescription(community.description);
    setVisibility(community.privacy_level.toLowerCase());
    setImage(community.profile_image);
    setBanner(community.cover_image);
  }, [community]);

  if (isLoading) return <p className="text-center text-muted-foreground py-10">Cargando…</p>;
  if (isError || !community) return <p className="text-center py-10">Comunidad no encontrada.</p>;
  // El backend permite editar al dueño o a un moderador (Auth0 RBAC).
  if (user?.id !== community.creator_id && !isModerator()) return <p className="text-center py-10">No puedes editar esta comunidad.</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateCommunity(id, {
        description,
        visibility,
        image_url: image,
        banner_url: banner,
      });
      await queryClient.invalidateQueries({ queryKey: ["community", id] });
      await queryClient.invalidateQueries({ queryKey: ["communities"] });
      toast.success("Comunidad actualizada");
      navigate({ to: "/communities/$id", params: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar");
    }
  }

  return (
    <div className="max-w-2xl mx-auto w-full">
      <FeedHeader title={`Editar ${community.name}`} subtitle="Actualiza la información de tu comunidad" />
      <form onSubmit={save} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
        <ImageUpload label="Imagen de la comunidad" prefix="communities" variant="avatar" value={image} onChange={setImage} />
        <ImageUpload label="Portada" prefix="communities" value={banner} onChange={setBanner} />
        <div>
          <Label htmlFor="desc">Descripción</Label>
          <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </div>
        <div>
          <Label>Privacidad</Label>
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VISIBILITY.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate({ to: "/communities/$id", params: { id } })}>Cancelar</Button>
          <Button type="submit" className="rounded-full">Guardar cambios</Button>
        </div>
      </form>
    </div>
  );
}

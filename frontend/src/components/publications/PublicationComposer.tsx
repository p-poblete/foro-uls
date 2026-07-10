import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCommunities, createPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ALL_LABELS, LABEL_LABELS } from "@/constants";
import type { PublicationLabel } from "@/types";
import { Draft, emptyDraft, saveDraft, deleteDraft, readDrafts } from "@/lib/drafts";
import { ImageUpload } from "@/components/ImageUpload";
import { toast } from "sonner";
import { FileText, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<Draft> & { id?: string };
  mode?: "create" | "edit";
  onSubmit?: (data: Draft) => void;
}

export function PublicationComposer({ open, onOpenChange, initial, mode = "create", onSubmit }: Props) {
  const user = useAuth();
  const queryClient = useQueryClient();
  const { data: communities } = useQuery({ queryKey: ["communities"], queryFn: fetchCommunities });
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft(), ...initial }));
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Evita el doble-submit: sin esto, dos clics rápidos durante el await crean
  // la publicación dos veces (el POST no es idempotente).
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft({ ...emptyDraft(), ...initial });
      setDrafts(readDrafts());
      setErrors({});
    }
  }, [open, initial]);

  function update<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: v, updated_at: new Date().toISOString() }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (draft.title.trim().length < 5) e.title = "Mínimo 5 caracteres.";
    if (draft.title.length > 300) e.title = "Máximo 300 caracteres.";
    if (!draft.community_id) e.community_id = "Selecciona una comunidad.";
    if (draft.external_link && !/^https?:\/\/.+/i.test(draft.external_link))
      e.external_link = "Debe empezar con http:// o https://";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSaveDraft() {
    saveDraft(draft);
    setDrafts(readDrafts());
    toast.success("Borrador guardado");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // ya hay un envío en vuelo
    if (!validate()) return;

    // Modo edición u otro flujo externo: delega en el padre.
    if (onSubmit) {
      onSubmit(draft);
      deleteDraft(draft.id);
      toast.success(mode === "create" ? "Publicación creada" : "Publicación actualizada");
      onOpenChange(false);
      return;
    }

    // Modo crear por defecto: persiste en la API.
    if (!user) return toast.error("Inicia sesión para publicar.");
    setSubmitting(true);
    try {
      await createPost({
        community_id: draft.community_id,
        author_id: user.id,
        title: draft.title,
        content: draft.content,
        label: draft.label,
        external_link: draft.external_link || null,
        image_url: draft.image_url || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
      await queryClient.invalidateQueries({ queryKey: ["community-posts", draft.community_id] });
      deleteDraft(draft.id);
      toast.success("Publicación creada");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo publicar");
    } finally {
      setSubmitting(false);
    }
  }

  function loadDraft(d: Draft) {
    setDraft(d);
    toast("Borrador cargado");
  }

  function removeDraft(id: string) {
    deleteDraft(id);
    setDrafts(readDrafts());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Crear publicación" : "Editar publicación"}</DialogTitle>
          <DialogDescription>
            Comparte una pregunta, discusión, caso o anuncio con la comunidad.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Comunidad *</Label>
            <Select value={draft.community_id} onValueChange={(v) => update("community_id", v)}>
              <SelectTrigger><SelectValue placeholder="Elige una comunidad" /></SelectTrigger>
              <SelectContent>
                {(communities ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.community_id && <p className="text-xs text-destructive mt-1">{errors.community_id}</p>}
          </div>

          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={draft.title}
              onChange={(e) => update("title", e.target.value)}
              maxLength={300}
              placeholder="Un título claro y descriptivo"
            />
            <div className="flex justify-between mt-1">
              {errors.title
                ? <p className="text-xs text-destructive">{errors.title}</p>
                : <span />}
              <span className="text-xs text-muted-foreground">{draft.title.length}/300</span>
            </div>
          </div>

          <div>
            <Label>Etiqueta</Label>
            <Select
              value={draft.label ?? "NONE"}
              onValueChange={(v) => update("label", v === "NONE" ? null : v as PublicationLabel)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Sin etiqueta</SelectItem>
                {ALL_LABELS.map((l) => <SelectItem key={l} value={l}>{LABEL_LABELS[l]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="content">Contenido</Label>
            <Textarea
              id="content"
              value={draft.content}
              onChange={(e) => update("content", e.target.value)}
              rows={6}
              placeholder="Escribe aquí tu publicación..."
            />
          </div>

          <ImageUpload
            label="Imagen (opcional)"
            prefix="posts"
            value={draft.image_url || null}
            onChange={(url) => update("image_url", url ?? "")}
          />

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tags">Tags (separados por coma)</Label>
              <Input
                id="tags"
                value={draft.tags}
                onChange={(e) => update("tags", e.target.value)}
                placeholder="python, ayuda"
              />
            </div>
            <div>
              <Label htmlFor="link">Enlace externo</Label>
              <Input
                id="link"
                value={draft.external_link}
                onChange={(e) => update("external_link", e.target.value)}
                placeholder="https://..."
              />
              {errors.external_link && <p className="text-xs text-destructive mt-1">{errors.external_link}</p>}
            </div>
          </div>

          {mode === "create" && drafts.length > 0 && (
            <div className="rounded-lg border border-dashed border-border p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <FileText className="h-3.5 w-3.5" /> Borradores guardados
              </div>
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {drafts.map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-sm gap-2">
                    <button
                      type="button"
                      onClick={() => loadDraft(d)}
                      className="truncate text-left hover:text-primary flex-1"
                    >
                      {d.title || "(sin título)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDraft(d.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Eliminar borrador"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={submitting}>
              Guardar borrador
            </Button>
            <Button type="submit" className="rounded-full" disabled={submitting}>
              {submitting ? "Publicando…" : mode === "create" ? "Publicar" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

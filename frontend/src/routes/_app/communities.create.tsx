import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createCommunity } from "@/lib/api";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PRIVACY_DESCRIPTIONS, PRIVACY_LABELS } from "@/constants";
import { requireAuth, useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/communities/create")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Crear comunidad — Readuls" }] }),
  component: CreateCommunityPage,
});

function CreateCommunityPage() {
  const navigate = useNavigate();
  const user = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<"PUBLIC" | "PRIVATE" | "RESTRICTED">("PUBLIC");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("El nombre es obligatorio.");
    if (!user) return toast.error("Inicia sesión para crear una comunidad.");
    try {
      await createCommunity({ name, description, owner_id: user.id });
      await queryClient.invalidateQueries({ queryKey: ["communities"] });
      toast.success(`Comunidad "${name}" creada`);
      navigate({ to: "/communities" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la comunidad");
    }
  }

  return (
    <div className="max-w-2xl mx-auto w-full">
      <FeedHeader title="Crear una comunidad" subtitle="Define un espacio temático para tu carrera o interés" />
      <form onSubmit={submit} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div>
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. Ingenieria_Software_ULS" />
        </div>
        <div>
          <Label htmlFor="desc">Descripción</Label>
          <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="¿De qué trata esta comunidad?" />
        </div>
        <div>
          <Label>Privacidad</Label>
          <RadioGroup value={privacy} onValueChange={(v: any) => setPrivacy(v)} className="mt-2 space-y-2">
            {(["PUBLIC", "RESTRICTED", "PRIVATE"] as const).map((p) => (
              <label key={p} className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:border-primary/40">
                <RadioGroupItem value={p} id={p} className="mt-1" />
                <div>
                  <div className="font-medium text-sm">{PRIVACY_LABELS[p]}</div>
                  <div className="text-xs text-muted-foreground">{PRIVACY_DESCRIPTIONS[p]}</div>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>
        <Button type="submit" className="w-full rounded-full">Crear comunidad</Button>
      </form>
    </div>
  );
}

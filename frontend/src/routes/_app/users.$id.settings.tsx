import { createFileRoute, notFound } from "@tanstack/react-router";
import { USERS, CAREERS } from "@/lib/mock-data";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GENDER_LABELS } from "@/constants";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/users/$id/settings")({
  loader: ({ params }) => {
    const u = USERS.find((x) => x.id === params.id);
    if (!u) throw notFound();
    return { user: u };
  },
  head: () => ({ meta: [{ title: "Configuración — Readuls" }] }),
  errorComponent: ({ error }) => <p className="text-destructive">{error.message}</p>,
  notFoundComponent: () => <p>Usuario no encontrado.</p>,
  component: UserSettingsPage,
});

function UserSettingsPage() {
  const { user } = Route.useLoaderData();
  const [username, setUsername] = useState(user.username);
  const [gender, setGender] = useState(user.gender);
  const [career, setCareer] = useState(user.career_id);

  function save(e: React.FormEvent) {
    e.preventDefault();
    toast.success("Perfil actualizado (mock)");
  }

  return (
    <div className="max-w-2xl mx-auto w-full">
      <FeedHeader title="Configuración de perfil" subtitle="Edita tus datos personales" />
      <form onSubmit={save} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div>
          <Label htmlFor="u">Usuario</Label>
          <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <Label>Género</Label>
          <Select value={gender} onValueChange={(v: any) => setGender(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(GENDER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Carrera</Label>
          <Select value={career} onValueChange={setCareer}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CAREERS.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="rounded-full">Guardar cambios</Button>
      </form>
    </div>
  );
}

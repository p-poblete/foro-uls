import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { setSession } from "@/lib/auth";
import { createUser, updateUser, fetchCareers } from "@/lib/api";
import { toast } from "sonner";
import { GENDER_LABELS } from "@/constants";
import type { Gender } from "@/types";
import { AuthShell } from "./login";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Registro — Readuls" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { data: careers } = useQuery({ queryKey: ["careers"], queryFn: fetchCareers });
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<Gender>("MALE");
  const [career, setCareer] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim().toLowerCase().endsWith("@ulasalle.edu.pe"))
      return toast.error("Usa tu correo institucional @ulasalle.edu.pe.");
    if (password.length < 8) return toast.error("La contraseña debe tener al menos 8 caracteres.");
    try {
      const user = await createUser({ username, email, display_name: username });
      const updated = await updateUser(user.id, { gender, career_id: career || undefined });
      setSession("dev-session", updated);
      toast.success(`Cuenta creada para @${username}`);
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la cuenta");
    }
  }

  return (
    <AuthShell title="Crea tu cuenta" subtitle="Únete a Readuls con tu correo institucional ULS">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="e">Correo institucional</Label>
          <Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tuusuario@ulasalle.edu.pe" />
        </div>
        <div>
          <Label htmlFor="u">Usuario</Label>
          <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="mi_usuario" />
        </div>
        <div>
          <Label htmlFor="p">Contraseña</Label>
          <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          <p className="text-xs text-muted-foreground mt-1">Mínimo 8 caracteres con letras y números.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
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
              <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
              <SelectContent>
                {(careers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="submit" className="w-full rounded-full">Crear cuenta</Button>
        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Inicia sesión</Link>
        </p>
      </form>
    </AuthShell>
  );
}

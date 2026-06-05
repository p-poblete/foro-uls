import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { mockLogin } from "@/lib/auth";
import { toast } from "sonner";
import { CAREERS } from "@/lib/mock-data";
import { GENDER_LABELS } from "@/constants";
import type { Gender } from "@/types";
import { AuthShell } from "./login";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Registro — Readuls" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<Gender>("MALE");
  const [career, setCareer] = useState(CAREERS[0].id);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("La contraseña debe tener al menos 8 caracteres.");
    mockLogin(email, password);
    toast.success(`Cuenta creada para @${username}`);
    navigate({ to: "/" });
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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CAREERS.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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

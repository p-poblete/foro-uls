import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { mockLogin } from "@/lib/auth";
import { toast } from "sonner";
import { APP_NAME } from "@/constants";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Iniciar sesión — Readuls" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("ppobletea@ulasalle.edu.pe");
  const [password, setPassword] = useState("demo1234");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    mockLogin(email, password);
    toast.success("Sesión iniciada");
    navigate({ to: "/" });
  }

  return (
    <AuthShell title="Bienvenido de vuelta" subtitle="Inicia sesión con tu correo institucional ULS">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="e">Correo institucional</Label>
          <Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="p">Contraseña</Label>
          <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full rounded-full">Iniciar sesión</Button>
        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">Regístrate</Link>
        </p>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground">{APP_NAME}</p>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-primary text-primary-foreground p-12">
        <Link to="/" className="font-display italic text-2xl">readuls</Link>
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight">
            HablaLaSalle
          </h1>
          <p className="mt-4 text-primary-foreground/80 max-w-md">
            El foro académico de la Universidad La Salle. Comparte, debate y conecta con tu carrera.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© {new Date().getFullYear()} Universidad La Salle</p>
      </div>
      <div className="flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          <h2 className="font-display text-3xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

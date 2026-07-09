import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { setSession } from "@/lib/auth";
import { STORAGE_KEYS, API_BASE_URL } from "@/constants";
import type { UserProfile } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/oauth/callback")({
  component: OAuthCallback,
});

// El backend devuelve su propio shape (display_name, avatar_url…); lo mapeamos
// al UserProfile del frontend, conservando gender/career_id ya guardados.
function toUserProfile(u: Record<string, unknown>): UserProfile {
  return {
    id: String(u.id),
    email: (u.email as string) ?? "",
    username: (u.username as string) ?? "",
    profile_image: (u.avatar_url as string) ?? null,
    cover_image: null,
    gender: (u.gender as UserProfile["gender"]) ?? "NON_BINARY",
    career_id: u.career_id != null ? String(u.career_id) : "",
    created_at: (u.created_at as string) ?? "",
  };
}

function OAuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("token");

    // El token viaja en el fragmento (#) — nunca llega a servidores — pero no
    // debe quedar visible ni en el historial: se borra de la URL de inmediato.
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }

    // Cualquier error del login (la Action de Auth0 manda "access_denied" cuando
    // rechaza el dominio; el backend manda "dominio" como defensa en profundidad):
    // la sesión SSO de Auth0 quedó abierta con la cuenta rechazada, y sin logout
    // el próximo "Continuar con Google" reutiliza esa cuenta y vuelve a fallar.
    // Se cierra la sesión en Auth0 y se deja un flag para explicar el motivo.
    if (params.get("error")) {
      localStorage.setItem(STORAGE_KEYS.loginError, "dominio");
      window.location.href = `${API_BASE_URL}/api/auth/logout`;
      return;
    }

    async function run() {
      if (!token) throw new Error("sin token");
      // Fuente de verdad: /api/auth/me (no el fragmento de la URL).
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("token inválido");
      const { user } = await res.json();

      const profile = toUserProfile(user);
      setSession(token, profile);
      toast.success("Sesión iniciada con Google");
      // Ya tiene carrera (usuario recurrente) → directo al feed; si no, onboarding.
      const done = profile.career_id || localStorage.getItem(STORAGE_KEYS.onboarding);
      navigate({ to: done ? "/" : "/onboarding" });
    }

    run().catch(() => {
      toast.error("No se pudo iniciar sesión con Google");
      navigate({ to: "/login" });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen grid place-items-center text-muted-foreground">
      Conectando con Google…
    </div>
  );
}

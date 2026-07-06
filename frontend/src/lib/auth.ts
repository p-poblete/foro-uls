import { useEffect, useState } from "react";
import { redirect } from "@tanstack/react-router";
import { STORAGE_KEYS } from "@/constants";
import { fetchUsers } from "@/lib/api";
import type { UserProfile } from "@/types";

export function getStoredUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEYS.user);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setSession(token: string, user: UserProfile) {
  localStorage.setItem(STORAGE_KEYS.token, token);
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  window.dispatchEvent(new Event("auth-change"));
}

export function updateStoredUser(patch: Partial<UserProfile>) {
  const current = getStoredUser();
  if (!current) return;
  const next = { ...current, ...patch };
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(next));
  window.dispatchEvent(new Event("auth-change"));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
  window.dispatchEvent(new Event("auth-change"));
}

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  useEffect(() => {
    setUser(getStoredUser());
    const onChange = () => setUser(getStoredUser());
    window.addEventListener("auth-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("auth-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return user;
}

/** Route guard: redirects to /login if no session (client-side only). */
export function requireAuth() {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(STORAGE_KEYS.user);
  if (!raw) throw redirect({ to: "/login" });
}

/**
 * Login de desarrollo (sin OAuth): busca el usuario por correo en la BD real
 * y abre sesión. El token es un marcador local (el backend aún no exige JWT en
 * las rutas de datos). El login "real" es el de Google en /login.
 */
export async function devLogin(email: string): Promise<UserProfile> {
  const users = await fetchUsers();
  const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) throw new Error("No existe un usuario con ese correo. Usa el registro o el login con Google.");
  setSession("dev-session", user);
  return user;
}

import { useEffect, useState } from "react";
import { redirect } from "@tanstack/react-router";
import { STORAGE_KEYS, API_BASE_URL } from "@/constants";
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

/** Cierra sesión: limpia la sesión local y cierra también la sesión SSO en Auth0. */
export function logout() {
  clearSession();
  window.location.href = `${API_BASE_URL}/api/auth/logout`;
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


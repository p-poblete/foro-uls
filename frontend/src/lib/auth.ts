import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/constants";
import { CURRENT_USER } from "@/lib/mock-data";
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

/** Mock login: acepta cualquier credencial y guarda CURRENT_USER. */
export function mockLogin(_email: string, _password: string) {
  setSession("mock.jwt.token", CURRENT_USER);
}

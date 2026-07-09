import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/constants";

export type Theme = "light" | "dark";

// Fuente única de verdad del tema. El default es SIEMPRE claro: solo se entra
// en oscuro si el usuario lo eligió (localStorage). Un script inline en
// __root.tsx aplica la clase antes del primer paint (sin flash); aquí solo se
// mantiene el estado de React sincronizado entre todos los toggles montados.

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(STORAGE_KEYS.theme) === "dark" ? "dark" : "light";
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const sync = () => setTheme(getTheme());
    sync();
    apply(getTheme()); // reafirma la clase por si la navegación SSR la perdió
    window.addEventListener("theme-change", sync);
    return () => window.removeEventListener("theme-change", sync);
  }, []);

  function toggle() {
    const next: Theme = getTheme() === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEYS.theme, next);
    apply(next);
    window.dispatchEvent(new Event("theme-change")); // sincroniza los demás toggles
  }

  return { theme, toggle };
}

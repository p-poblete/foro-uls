import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function ThemeToggle({ variant = "navbar" }: { variant?: "navbar" | "plain" }) {
  const { theme, toggle } = useTheme();
  const isNav = variant === "navbar";
  return (
    <button
      onClick={toggle}
      aria-label="Cambiar tema"
      className={
        isNav
          ? "rounded-md p-2 hover:bg-white/10 text-primary-foreground"
          : "rounded-md p-2 hover:bg-accent text-foreground border border-border"
      }
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

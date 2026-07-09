import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, LogOut, Menu, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, logout } from "@/lib/auth";
import { fetchNotifications } from "@/lib/api";
import { initials } from "@/lib/format";
import { APP_NAME, STORAGE_KEYS } from "@/constants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { PublicationComposer } from "@/components/publications/PublicationComposer";

export function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const user = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    try { setReadIds(JSON.parse(localStorage.getItem(STORAGE_KEYS.notifsRead) ?? "[]")); }
    catch { /* noop */ }
    const on = () => {
      try { setReadIds(JSON.parse(localStorage.getItem(STORAGE_KEYS.notifsRead) ?? "[]")); }
      catch { /* noop */ }
    };
    window.addEventListener("notifs-change", on);
    return () => window.removeEventListener("notifs-change", on);
  }, []);

  const { data: notifications } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user,
  });
  const unread = (notifications ?? []).filter((n) => !n.is_read && !readIds.includes(n._id)).length;

  return (
    <header className="sticky top-0 z-40 w-full bg-primary text-primary-foreground shadow-sm">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 hover:bg-white/10 lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="font-display italic text-lg">readuls</span>
          <span className="hidden md:flex items-center gap-1 border-l border-white/30 pl-2 ml-1 font-display text-sm tracking-wide">
            <span className="font-semibold">La Salle</span>
            <span className="opacity-70 text-xs">Universidad</span>
          </span>
        </Link>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) navigate({ to: "/search", search: { q } });
          }}
          className="mx-auto flex-1 max-w-2xl"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar publicaciones, comunidades o usuarios..."
              className="w-full h-10 rounded-full bg-white/95 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-0 focus:ring-2 focus:ring-white/40"
            />
          </div>
        </form>

        <div className="flex items-center gap-1 md:gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <Button
                onClick={() => setComposerOpen(true)}
                className="bg-white text-primary hover:bg-white/90 rounded-full h-9 gap-1.5 hidden sm:inline-flex"
              >
                <Plus className="h-4 w-4" /> Crear
              </Button>
              <button
                onClick={() => setComposerOpen(true)}
                className="rounded-md p-2 hover:bg-white/10 sm:hidden"
                aria-label="Crear publicación"
              >
                <Plus className="h-5 w-5" />
              </button>

              <Link to="/notifications" className="relative rounded-md p-2 hover:bg-white/10">
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-[var(--color-label-case)] text-[10px] font-bold flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 rounded-full pl-2 pr-1 py-1 hover:bg-white/10">
                  <div className="hidden md:block text-right leading-tight">
                    <div className="text-xs font-semibold">{user.username}</div>
                    <div className="text-[11px] opacity-75">{user.email}</div>
                  </div>
                  <Avatar className="h-8 w-8 border border-white/30">
                    <AvatarImage src={user.profile_image ?? undefined} />
                    <AvatarFallback>{initials(user.username)}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/users/$id" params={{ id: user.id }}>Ver perfil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/bookmarks">Guardados</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/users/$id/settings" params={{ id: user.id }}>Configuración</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/communities/create">Crear comunidad</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/moderation">Panel de moderación</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()}>
                    <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
                <Link to="/login">Ingresar</Link>
              </Button>
              <Button asChild className="bg-white text-primary hover:bg-white/90">
                <Link to="/register">Registrarse</Link>
              </Button>
            </>
          )}
        </div>
      </div>
      <span className="sr-only">{APP_NAME}</span>
      {user && <PublicationComposer open={composerOpen} onOpenChange={setComposerOpen} />}
    </header>
  );
}

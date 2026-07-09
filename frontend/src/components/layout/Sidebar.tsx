import { Link } from "@tanstack/react-router";
import { Home, Megaphone, Map, BookOpen, Bookmark, Shield, Tag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchCareers } from "@/lib/api";
import { ALL_LABELS, LABEL_LABELS } from "@/constants";
import { useAuth, isModerator } from "@/lib/auth";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const user = useAuth();
  const { data: careers } = useQuery({ queryKey: ["careers"], queryFn: fetchCareers });
  return (
    <nav className="h-full overflow-y-auto py-6 px-3">
      <SectionLink to="/" icon={<Home className="h-4 w-4" />} label="Principal" onNavigate={onNavigate} />
      <SectionLink to="/feed/announcements" icon={<Megaphone className="h-4 w-4" />} label="Anuncios" onNavigate={onNavigate} />
      <SectionLink to="/communities" icon={<Map className="h-4 w-4" />} label="Explorar" onNavigate={onNavigate} />
      {user && (
        <SectionLink to="/bookmarks" icon={<Bookmark className="h-4 w-4" />} label="Guardados" onNavigate={onNavigate} />
      )}

      <div className="mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Etiquetas
      </div>
      <div className="mt-1">
        {ALL_LABELS.map((l) => (
          <Link
            key={l}
            to="/feed/label/$label"
            params={{ label: l }}
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-sidebar-foreground/80 hover:bg-accent hover:text-accent-foreground transition-colors"
            activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
          >
            <Tag className="h-3.5 w-3.5" /> {LABEL_LABELS[l]}
          </Link>
        ))}
      </div>

      <div className="mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Carreras
      </div>
      <div className="mt-1">
        {(careers ?? []).map((c) => (
          <Link
            key={c.id}
            to="/feed/career/$careerCode"
            params={{ careerCode: c.code }}
            onClick={onNavigate}
            className="block rounded-md px-3 py-1.5 text-sm text-sidebar-foreground/80 hover:bg-accent hover:text-accent-foreground transition-colors"
            activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-1">
        <SectionLink to="/rules" icon={<BookOpen className="h-4 w-4" />} label="Reglas de ReadULS" onNavigate={onNavigate} />
        {user && isModerator() && <SectionLink to="/moderation" icon={<Shield className="h-4 w-4" />} label="Moderación" onNavigate={onNavigate} />}
      </div>
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden lg:block w-64 shrink-0 border-r border-sidebar-border bg-sidebar">
      <div className="sticky top-16 h-[calc(100vh-4rem)]">
        <SidebarContent />
      </div>
    </aside>
  );
}

function SectionLink({ to, icon, label, onNavigate }: { to: string; icon: React.ReactNode; label: string; onNavigate?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      activeProps={{ className: "bg-accent text-accent-foreground" }}
      activeOptions={{ exact: to === "/" }}
    >
      {icon}
      {label}
    </Link>
  );
}

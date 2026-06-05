import { Link } from "@tanstack/react-router";
import { Home, Megaphone, Map, BookOpen } from "lucide-react";
import { CAREERS } from "@/lib/mock-data";

export function Sidebar() {
  return (
    <aside className="hidden lg:block w-64 shrink-0 border-r border-sidebar-border bg-sidebar">
      <nav className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto py-6 px-3">
        <SectionLink to="/" icon={<Home className="h-4 w-4" />} label="Principal" />
        <SectionLink to="/feed/announcements" icon={<Megaphone className="h-4 w-4" />} label="Anuncios" />
        <SectionLink to="/communities" icon={<Map className="h-4 w-4" />} label="Explorar" />

        <div className="mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Carreras
        </div>
        <div className="mt-1">
          {CAREERS.map((c) => (
            <Link
              key={c.id}
              to="/feed/career/$careerCode"
              params={{ careerCode: c.code }}
              className="block rounded-md px-3 py-1.5 text-sm text-sidebar-foreground/80 hover:bg-accent hover:text-accent-foreground transition-colors"
              activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
            >
              {c.name}
            </Link>
          ))}
        </div>

        <div className="mt-6">
          <SectionLink to="/rules" icon={<BookOpen className="h-4 w-4" />} label="Reglas de ReadULS" />
        </div>
      </nav>
    </aside>
  );
}

function SectionLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      activeProps={{ className: "bg-accent text-accent-foreground" }}
      activeOptions={{ exact: to === "/" }}
    >
      {icon}
      {label}
    </Link>
  );
}

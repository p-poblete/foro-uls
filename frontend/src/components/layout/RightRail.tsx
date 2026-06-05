import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { COMMUNITIES, CURRENT_USER } from "@/lib/mock-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, compactNumber } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import readulsLogo from "@/assets/readuls-mark.svg";

export function RightRail() {
  const user = useAuth();
  const popular = [...COMMUNITIES].sort((a, b) => b.member_count - a.member_count).slice(0, 4);
  const mine = COMMUNITIES.filter((c) => c.is_member).slice(0, 4);

  return (
    <aside className="hidden xl:flex flex-col gap-4 w-80 shrink-0 py-6 pl-2 pr-6">
      {/* AI agent */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="text-xs font-semibold text-muted-foreground mb-2">Habla con readuls.ia</div>
        <div className="flex items-center justify-center py-2">
          <img src={readulsLogo} alt="readuls.ia" className="h-16 w-16" />
        </div>
        <div className="relative mt-2">
          <input
            placeholder="Pregúntale a readuls"
            className="w-full h-9 rounded-full border border-border bg-background pl-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <CommunityList title="Comunidades populares" items={popular} />
      {user && mine.length > 0 && <CommunityList title="Mis Comunidades" items={mine} />}

      <p className="px-2 text-[11px] text-muted-foreground">
        Hecho con ❤ para la comunidad ULS — {new Date().getFullYear()}
      </p>
      {!user && (
        <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
          Inicia sesión como <span className="font-medium text-foreground">{CURRENT_USER.username}</span> para reaccionar y comentar.
        </div>
      )}
    </aside>
  );
}

function CommunityList({ title, items }: { title: string; items: typeof COMMUNITIES }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="text-sm font-semibold mb-3">{title}</div>
      <ul className="space-y-3">
        {items.map((c) => (
          <li key={c.id}>
            <Link to="/communities/$id" params={{ id: c.id }} className="flex items-center gap-3 group">
              <Avatar className="h-9 w-9">
                <AvatarImage src={c.profile_image ?? undefined} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                  {initials(c.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate group-hover:text-primary">
                  {c.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {compactNumber(c.member_count)} miembros
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

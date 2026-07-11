import { createFileRoute, Outlet, Link, useLocation, useNavigate, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Building2, DollarSign, FileText, Settings, TrendingUp, LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  component: WeazeLayout,
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: isAdmin, error } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (error) {
      console.warn("[admin] has_role RPC failed — redirecting to /app", error);
      throw redirect({ to: "/app" });
    }
    if (!isAdmin) throw redirect({ to: "/app" });
  },
});

const items = [
  { to: "/admin", label: "Dashboard", icon: BarChart3, exact: true },
  { to: "/admin/empresas", label: "Empresas", icon: Building2 },
  { to: "/admin/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/admin/licencas", label: "Licenças", icon: FileText },
  { to: "/admin/metricas", label: "Métricas", icon: TrendingUp },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

function WeazeLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-secondary/30 flex">
      <aside className="hidden md:flex w-60 bg-background border-r border-border flex-col p-4">
        <div className="flex items-center gap-2 mb-8">
          <div className="h-8 w-8 rounded-lg bg-brand grid place-items-center text-primary-foreground font-bold">
            <Shield className="h-4 w-4" />
          </div>
          <span className="font-display text-xl">WEAZE Admin</span>
        </div>
        <nav className="space-y-1 flex-1">
          {items.map(({ to, icon: Icon, label, exact }) => {
            const active = exact
              ? location.pathname === to
              : location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={async () => { localStorage.removeItem("weaze:login_timestamp"); await supabase.auth.signOut(); navigate({ to: "/auth" }); }}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="md:hidden border-b border-border bg-background px-4 h-14 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {items.map(({ to, label, exact }) => {
            const active = exact
              ? location.pathname === to
              : location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors",
                  active ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                )}
              >
                {label}
              </Link>
            );
          })}
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-auto"><Outlet /></main>
      </div>
    </div>
  );
}

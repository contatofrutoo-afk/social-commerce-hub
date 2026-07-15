import { createFileRoute, Outlet, Link, useLocation, useNavigate, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { BarChart3, Building2, DollarSign, FileText, Settings, TrendingUp, LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

async function waitForAdminSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  return new Promise<Session | null>((resolve) => {
    let settled = false;
    let unsubscribe = () => {};
    const timeout = window.setTimeout(async () => {
      const refreshed = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      finish(refreshed.data.session);
    }, 900);

    const finish = (session: Session | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(session);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      finish(session);
    });
    unsubscribe = () => authListener.subscription.unsubscribe();
  });
}

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  component: WeazeLayout,
  beforeLoad: async ({ location }) => {
    const session = await waitForAdminSession();
    if (!session) {
      const redirectTo = `${location.pathname}${location.searchStr || ""}`;
      throw redirect({ to: "/auth", search: { redirect: redirectTo } as never });
    }
    const { data: isAdmin, error } = await supabase.rpc("has_role", {
      _user_id: session.user.id,
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
    <div className="min-h-screen dash-surface flex">
      <aside className="hidden md:flex w-60 bg-card/70 backdrop-blur border-r border-border flex-col p-4">
        <div className="flex items-center gap-2 mb-8">
          <div className="h-9 w-9 rounded-xl bg-primary grid place-items-center text-primary-foreground shadow-sm">
            <Shield className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-base font-bold leading-tight">WEAZE</div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Admin
            </div>
          </div>
        </div>
        <nav className="space-y-0.5 flex-1">
          {items.map(({ to, icon: Icon, label, exact }) => {
            const active = exact
              ? location.pathname === to
              : location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="md:hidden border-b border-border bg-card/85 backdrop-blur-xl px-4 h-14 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {items.map(({ to, label, exact }) => {
            const active = exact
              ? location.pathname === to
              : location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-colors",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary text-muted-foreground"
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

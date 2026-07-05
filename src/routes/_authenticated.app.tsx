import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3,
  Users,
  Newspaper,
  Package,
  ShoppingCart,
  Store,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const { data: role } = useQuery({
    queryKey: ["my-role"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("*, company:companies(*)")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const nav: { to: any; label: string; icon: any; exact?: boolean }[] = [
    { to: "/app", label: "Dashboard", icon: BarChart3, exact: true },
    { to: "/app/clientes", label: "Clientes", icon: Users },
    { to: "/app/feed", label: "Feed", icon: Newspaper },
    { to: "/app/produtos", label: "Produtos", icon: Package },
    { to: "/app/pedidos", label: "Pedidos", icon: ShoppingCart },
    { to: "/app/atendimento", label: "Atendimento", icon: Store },
    { to: "/app/configuracoes", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-60 flex-col border-r bg-card p-4 md:flex">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
            W
          </div>
          <div>
            <div className="text-sm font-semibold">WEAZE</div>
            <div className="text-xs text-muted-foreground">{role?.company?.name ?? "Painel"}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map((n) => {
            const active = n.exact
              ? location.pathname === n.to
              : location.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <n.icon className="size-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
        >
          <LogOut className="size-4" /> Sair
        </button>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-10 flex items-center justify-between border-b bg-card p-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded bg-primary text-primary-foreground text-sm font-bold">
            W
          </div>
          <span className="font-semibold">{role?.company?.name ?? "WEAZE"}</span>
        </div>
      </div>

      <main className="flex-1 overflow-x-hidden p-6 pt-20 md:pt-6">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 grid grid-cols-6 border-t bg-card md:hidden">
        {nav.slice(0, 6).map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="flex flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground"
          >
            <n.icon className="size-4" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
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
  ShieldAlert,
  MessageCircle,
  QrCode,
  ChartColumn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ensureUserRole } from "@/lib/auth.functions";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: role, refetch: refetchRole } = useQuery({
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

  useEffect(() => {
    if (role === null) {
      ensureUserRole()
        .then((result) => {
          if (result.ok) {
            queryClient.invalidateQueries({ queryKey: ["my-company-id"] });
            refetchRole();
          } else {
            toast.error("Erro ao vincular sua conta a uma empresa.");
          }
        })
        .catch((err) => {
          toast.error(err?.message ?? "Erro ao configurar acesso.");
        });
    }
  }, [role, refetchRole, queryClient]);

  const { data: companyStatus } = useQuery({
    queryKey: ["company-status-block", role?.company_id],
    queryFn: async () => {
      if (!role?.company_id) return null;

      let status: string | undefined;
      const { data: coData } = await supabase
        .from("companies")
        .select("status")
        .eq("id", role.company_id)
        .single();
      status = coData?.status;

      if (!status) {
        const { data: adminData } = await supabase
          .from("company_admin")
          .select("status")
          .eq("company_id", role.company_id)
          .maybeSingle();
        if (adminData?.status === "blocked") status = "bloqueado";
        else if (adminData?.status === "active") status = "ativo";
        else if (adminData?.status === "trial") status = "teste";
        else if (adminData?.status === "cancelled") status = "cancelado";
      }

      return { status };
    },
    enabled: !!role?.company_id,
  });

  const { data: settings } = useQuery({
    queryKey: ["admin-settings-block"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("blocked_message, admin_contact")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const isBlocked = companyStatus?.status === "bloqueado";
  const blockedMessage = settings?.blocked_message || "Seu acesso à plataforma encontra-se temporariamente bloqueado. Para mais informações entre em contato com o administrador da WEAZE.";
  const adminContact = settings?.admin_contact || "";

  if (isBlocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 text-center">
        <div className="max-w-md">
          <ShieldAlert className="mx-auto h-16 w-16 text-destructive mb-6" />
          <h1 className="font-display text-2xl font-bold mb-3">
            Seu acesso está temporariamente bloqueado
          </h1>
          <p className="text-muted-foreground mb-6">
            {blockedMessage}
          </p>
          {adminContact && (
            <p className="text-sm text-muted-foreground mb-4">
              Contato: {adminContact}
            </p>
          )}
          <Button disabled className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Entrar em contato
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            * Chamada via WhatsApp será implementada em breve
          </p>
        </div>
      </div>
    );
  }

  const nav: { to: any; label: string; icon: any; exact?: boolean }[] = [
    { to: "/app", label: "Dashboard", icon: BarChart3, exact: true },
    { to: "/app/clientes", label: "Clientes", icon: Users },
    { to: "/app/feed", label: "Publicações", icon: Newspaper },
    { to: "/app/produtos", label: "Produtos", icon: Package },
    { to: "/app/catalogo", label: "Catálogo Inteligente", icon: QrCode },
    { to: "/app/inteligencia", label: "Inteligência do Catálogo", icon: ChartColumn },
    { to: "/app/pedidos", label: "Pedidos", icon: ShoppingCart },
    { to: "/app/atendimento", label: "Atendimento", icon: Store },
    { to: "/app/configuracoes", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 flex-col border-r bg-card p-5 md:flex">
        <div className="mb-8 flex items-center gap-3">
          {role?.company?.logo_url ? (
            <img src={role.company.logo_url} alt="" className="size-10 rounded-xl object-cover ring-1 ring-border" />
          ) : (
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10">
              <Logo className="h-5" />
            </div>
          )}
          <div className="min-w-0">
            <Logo className="h-4" />
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {role?.company?.name ?? "Painel"}
            </div>
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
      <div className="fixed inset-x-0 top-0 z-10 flex items-center justify-between border-b bg-card/90 backdrop-blur px-4 py-3 md:hidden">
        <Logo className="h-6" />
        <span className="truncate text-sm font-medium text-muted-foreground">
          {role?.company?.name ?? ""}
        </span>
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

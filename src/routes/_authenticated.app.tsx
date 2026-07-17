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
  QrCode,
  ChartColumn,
  BrainCircuit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ensureUserRole } from "@/lib/auth.functions";
import { Logo } from "@/components/logo";

// Status que precisam ser tratados na página /payment
const PAYMENT_GATE_STATUSES = new Set([
  "aguardando_pagamento",
  "pagamento_em_analise",
  "bloqueado",
  "cancelado",
]);

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: role,
    refetch: refetchRole,
    isLoading: roleLoading,
  } = useQuery({
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

  const isSuperAdmin = role?.role === "admin";

  useEffect(() => {
    // Super admin não deve ficar em /app
    if (isSuperAdmin) {
      navigate({ to: "/admin" });
    }
  }, [isSuperAdmin, navigate]);

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

  const {
    data: companyStatus,
    isLoading: statusLoading,
    isError: statusError,
  } = useQuery({
    queryKey: ["company-status-block", role?.company_id],
    queryFn: async () => {
      if (!role?.company_id) return null;
      const { data: coData } = await supabase
        .from("companies")
        .select("status")
        .eq("id", role.company_id)
        .single();
      return { status: coData?.status as string | undefined };
    },
    enabled: !!role?.company_id && !isSuperAdmin,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    refetchInterval: 30_000,
    retry: 3,
  });

  // Redireciona para /payment se status exige gate
  useEffect(() => {
    const s = companyStatus?.status;
    if (s && PAYMENT_GATE_STATUSES.has(s)) {
      navigate({ to: "/payment" });
    }
  }, [companyStatus?.status, navigate]);

  // Fail-safe: enquanto o status da empresa não é confirmado (ou se houve erro
  // na consulta), NÃO renderizamos o conteúdo. Isso impede que um dono com
  // status pendente/bloqueado veja qualquer parte do painel via nova aba,
  // aba anônima ou recarregamento antes do redirect para /payment ocorrer.
  if (!isSuperAdmin && role?.company_id && (statusLoading || statusError || !companyStatus)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="text-sm text-muted-foreground">Verificando acesso…</div>
      </div>
    );
  }

  // Se status exige gate de pagamento, não renderiza o painel enquanto o
  // useEffect faz o redirect para /payment.
  if (!isSuperAdmin && companyStatus?.status && PAYMENT_GATE_STATUSES.has(companyStatus.status)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="text-sm text-muted-foreground">Redirecionando…</div>
      </div>
    );
  }

  const nav: { to: any; label: string; icon: any; exact?: boolean }[] = [
    { to: "/app", label: "Dashboard", icon: BarChart3, exact: true },
    { to: "/app/clientes", label: "Clientes", icon: Users },
    { to: "/app/persona", label: "Persona Inteligente", icon: BrainCircuit },
    { to: "/app/feed", label: "Publicações", icon: Newspaper },
    { to: "/app/produtos", label: "Produtos", icon: Package },
    { to: "/app/catalogo", label: "Catálogo Inteligente", icon: QrCode },
    { to: "/app/inteligencia", label: "Inteligência do Catálogo", icon: ChartColumn },
    { to: "/app/pedidos", label: "Pedidos", icon: ShoppingCart },
    { to: "/app/atendimento", label: "Atendimento", icon: Store },
    { to: "/app/configuracoes", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen dash-surface">
      <aside className="hidden w-64 flex-col border-r bg-card/70 p-5 backdrop-blur md:flex">
        <div className="mb-8 flex items-center gap-3">
          {role?.company?.logo_url ? (
            <img
              src={role.company.logo_url}
              alt=""
              className="size-11 rounded-2xl object-cover ring-1 ring-border shadow-sm"
            />
          ) : (
            <div className="grid size-11 place-items-center rounded-2xl bg-primary/10">
              <Logo className="h-5" />
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{role?.company?.name ?? "Painel"}</div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Comércio
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5">
          {nav.map((n) => {
            const active = n.exact
              ? location.pathname === n.to
              : location.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
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
          className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="size-4" /> Sair
        </button>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-10 flex items-center justify-between border-b bg-card/85 backdrop-blur-xl px-4 py-3 md:hidden">
        <span className="truncate text-sm font-semibold">{role?.company?.name ?? ""}</span>
      </div>

      <main className="flex-1 overflow-x-hidden p-6 pt-20 md:pt-6">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 grid grid-cols-6 border-t bg-card/95 backdrop-blur-xl md:hidden">
        {nav.slice(0, 6).map((n) => {
          const active = n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { companyRepository } from "@/repositories";
import { Newspaper, ShoppingBag, User, Camera } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import ClientSessionGuard from "@/components/ClientSessionGuard";

export const Route = createFileRoute("/c/$companySlug")({
  component: ClientLayout,
});

function ClientLayout() {
  const { companySlug } = Route.useParams();
  const { data: company } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
    staleTime: 30_000,
  });
  const cart = useCart(company?.id);
  const location = useLocation();
  const path = location.pathname;

  const tabs = [
    { to: "/c/$companySlug/feed", label: "Feed", icon: Newspaper },
    { to: "/c/$companySlug/publicar", label: "Publicar", icon: Camera },
    { to: "/c/$companySlug/sacola", label: "Sacola", icon: ShoppingBag, badge: cart.count },
    { to: "/c/$companySlug/perfil", label: "Perfil", icon: User },
  ] as const;

  const isVendas = path.includes("/vendas");
  const showTabs = !path.match(new RegExp(`/c/${companySlug}/?$`)) && !path.includes("/m/") && !isVendas;

  return (
    <div className={`min-h-screen bg-background ${isVendas ? "" : "pb-20"}`}>
      {showTabs && <ClientSessionGuard />}
      {!isVendas && (
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link
            to="/c/$companySlug/feed"
            params={{ companySlug }}
            className="flex items-center gap-3"
          >
            {company?.logoUrl ? (
              <img
                src={company.logoUrl}
                alt=""
                className="size-9 rounded-xl object-cover ring-1 ring-border"
              />
            ) : (
              <div className="grid size-9 place-items-center rounded-xl bg-primary/10">
                <Logo className="h-4" />
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate font-display text-sm font-bold">
                {company?.name ?? "Estabelecimento"}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                by WEAZE
              </div>
            </div>
          </Link>
          <Link to="/c/$companySlug/perfil" params={{ companySlug }}>
            <Logo className="h-16 sm:h-20" />
          </Link>
        </div>
      </header>
      )}

      <main className="mx-auto max-w-2xl">
        <Outlet />
      </main>

      {showTabs && (
        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background">
          <div className="mx-auto grid max-w-2xl grid-cols-4">
            {tabs.map((t) => {
              const active = location.pathname.includes(t.to.replace("/c/$companySlug", ""));
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  params={{ companySlug }}
                  className={cn(
                    "flex flex-col items-center gap-1 py-3 text-xs",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <div className="relative">
                    <t.icon className="size-5" />
                    {"badge" in t && (t.badge ?? 0) > 0 && (
                      <span className="absolute -right-2 -top-1 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {t.badge}
                      </span>
                    )}
                  </div>
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

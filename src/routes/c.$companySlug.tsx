import { createFileRoute, Outlet, Link, redirect, useParams, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { companyRepository } from "@/repositories";
import { Home, Newspaper, ShoppingBag, User, Camera } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/c/$companySlug")({
  component: ClientLayout,
});

function ClientLayout() {
  const { companySlug } = Route.useParams();
  const { data: company } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
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

  const showTabs = !path.endsWith(`/c/${companySlug}`) && !path.includes("/m/");

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link
            to="/c/$companySlug/feed"
            params={{ companySlug }}
            className="flex items-center gap-2"
          >
            <div className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
              W
            </div>
            <span className="font-semibold">{company?.name ?? "WEAZE"}</span>
          </Link>
          <Link to="/c/$companySlug/perfil" params={{ companySlug }}>
            <div className="grid size-9 place-items-center rounded-full bg-accent text-accent-foreground">
              <Home className="size-4" />
            </div>
          </Link>
        </div>
      </header>

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

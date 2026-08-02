import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { companyRepository, orderRepository } from "@/repositories";
import { getSessionForCompany, type WeazeSession } from "@/lib/session";
import { onboardViaQr } from "@/lib/qr-onboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_META, orderStatusLabel, paymentMethodLabel } from "@/lib/order-status";
import { formatBRL, formatDateTime, relativeTime } from "@/lib/format";
import { PackageOpen, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/c/$companySlug/meus-pedidos")({
  component: MyOrdersPage,
  head: () => ({ meta: [{ title: "Meus Pedidos" }] }),
});

function MyOrdersPage() {
  const { companySlug } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<WeazeSession | null>(() =>
    typeof window !== "undefined" ? getSessionForCompany(companySlug) : null,
  );
  const [onboarding, setOnboarding] = useState(false);

  const { data: company } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
  });

  useEffect(() => {
    if (session || !company) return;
    let cancelled = false;
    setOnboarding(true);
    onboardViaQr({ companyId: company.id, companySlug, tableId: null, source: "link" })
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(e instanceof Error ? e.message : "Não foi possível iniciar a sessão.");
        navigate({ to: "/c/$companySlug/desconexao", params: { companySlug } });
      })
      .finally(() => {
        if (!cancelled) setOnboarding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, company, companySlug, navigate]);

  const { data: orders, isFetching, refetch } = useQuery({
    queryKey: ["customer-orders", session?.customerId],
    queryFn: () => orderRepository.listByCustomer(session!.customerId, session!.sessionToken),
    enabled: !!session,
    refetchInterval: 15000,
  });

  if (!session) {
    if (onboarding) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="animate-pulse text-sm text-muted-foreground">Carregando seus pedidos...</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Meus Pedidos</h1>
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          disabled={isFetching}
          onClick={() => refetch()}
        >
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {(orders ?? []).length === 0 ? (
        <div className="py-16 text-center">
          <PackageOpen className="mx-auto size-12 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">Você ainda não fez nenhum pedido.</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/c/$companySlug/feed", params: { companySlug } })}>
            Ver catálogo
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders!.map((o) => (
            <div key={o.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">#{o.id.slice(0, 6).toUpperCase()}</div>
                  <div className="text-xs text-muted-foreground">
                    {relativeTime(o.createdAt)} · {formatDateTime(o.createdAt)}
                  </div>
                </div>
                <Badge variant={ORDER_STATUS_META[o.status]?.variant ?? "secondary"}>
                  {orderStatusLabel(o.status)}
                </Badge>
              </div>

              <div className="mt-3 space-y-1">
                {o.items.map((i) => (
                  <div key={i.id} className="flex items-center justify-between text-sm">
                    <span className="truncate pr-2">
                      {i.productName} <span className="text-muted-foreground">× {i.quantity}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatBRL(i.quantity * i.unitPrice)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between border-t pt-2 text-sm">
                <span className="text-xs text-muted-foreground">
                  {paymentMethodLabel(o.paymentMethod)}
                </span>
                <span className="font-bold">{formatBRL(o.total)}</span>
              </div>

              {o.note && (
                <p className="mt-2 text-xs italic text-muted-foreground">"{o.note}"</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { companyRepository, orderRepository } from "@/repositories";
import { getSessionForCompany, type WeazeSession } from "@/lib/session";
import { onboardViaQr } from "@/lib/qr-onboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_META,
  orderStatusLabel,
  paymentMethodLabel,
  paymentStatusLabel,
} from "@/lib/order-status";
import { formatBRL } from "@/lib/format";
import { CheckCircle2, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { OrderItemOptions } from "@/components/product-options-selector";

export const Route = createFileRoute("/c/$companySlug/confirmado")({
  validateSearch: (search: Record<string, unknown>) => ({
    orderId: typeof search.orderId === "string" ? search.orderId : undefined,
    paymentId: typeof search.paymentId === "string" ? search.paymentId : undefined,
    status: typeof search.status === "string" ? search.status : undefined,
  }),
  component: OrderConfirmedPage,
  head: () => ({ meta: [{ title: "Pedido enviado" }] }),
});

function OrderConfirmedPage() {
  const { companySlug } = Route.useParams();
  const { orderId, paymentId, status } = Route.useSearch();
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
      })
      .finally(() => {
        if (!cancelled) setOnboarding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, company, companySlug]);

  const { data: order } = useQuery({
    queryKey: ["customer-order", session?.customerId, orderId],
    queryFn: async () => {
      const orders = await orderRepository.listByCustomer(session!.customerId, session!.sessionToken);
      return orders.find((o) => o.id === orderId) ?? null;
    },
    enabled: !!session && !!orderId,
    refetchInterval: 15000,
  });

  if (!session) {
    if (onboarding) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="animate-pulse text-sm text-muted-foreground">Confirmando seu pedido...</p>
        </div>
      );
    }
    return null;
  }

  const shortId = order ? order.id.slice(0, 6).toUpperCase() : (orderId?.slice(0, 6).toUpperCase() ?? "----");
  const waitingCounter = order?.status === "payment_at_counter";
  const awaitingPayment = order?.status === "awaiting_payment" || (!!paymentId && order?.paymentStatus === "pending");
  const approved = status === "approved" || order?.status === "payment_approved";
  const statusLabel = order ? orderStatusLabel(order.status) : "Enviado";
  const isTableOrder = !!order?.tableId;

  const subtitle = approved
    ? isTableOrder
      ? "O estabelecimento foi notificado. Acompanhe o status em tempo real."
      : "Sua compra foi concluída com sucesso."
    : awaitingPayment
      ? isTableOrder
        ? "Assim que o pagamento for confirmado, o estabelecimento começará o preparo."
        : "Assim que o pagamento for confirmado, sua compra será finalizada."
      : isTableOrder
        ? "O estabelecimento foi notificado. Acompanhe o status em tempo real."
        : "O estabelecimento foi notificado. Obrigado pela compra!";

  return (
    <div className="p-4">
      <div className="flex flex-col items-center py-10 text-center">
        {approved ? (
          <CheckCircle2 className="size-16 text-emerald-500" />
        ) : awaitingPayment ? (
          <Clock3 className="size-16 text-amber-500" />
        ) : (
          <CheckCircle2 className="size-16 text-emerald-500" />
        )}
        <h1 className="mt-4 text-xl font-bold">
          {approved ? "Pagamento aprovado!" : awaitingPayment ? "Aguardando confirmação" : "Pedido enviado!"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <dl className="divide-y">
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-muted-foreground">Pedido</dt>
            <dd className="text-sm font-medium">#{shortId}</dd>
          </div>
          {order && (
            <>
              <div className="flex items-center justify-between py-3">
                <dt className="text-sm text-muted-foreground">Forma de pagamento</dt>
                <dd className="text-sm font-medium">{paymentMethodLabel(order.paymentMethod)}</dd>
              </div>
              {order.paymentProvider === "mercadopago" && (
                <div className="flex items-center justify-between py-3">
                  <dt className="text-sm text-muted-foreground">Pagamento</dt>
                  <dd className="text-sm font-medium">{paymentStatusLabel(order.paymentStatus)}</dd>
                </div>
              )}
              {!isTableOrder && (
                <div className="space-y-1.5 py-3">
                  <dt className="text-sm text-muted-foreground">Itens</dt>
                  <div className="space-y-1">
                    {order.items.map((i) => (
                      <div key={i.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <span className="block truncate">
                            {i.productName} <span className="text-muted-foreground">× {i.quantity}</span>
                          </span>
                          <OrderItemOptions options={i.options} className="mt-0.5" />
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatBRL(i.quantity * i.unitPrice)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between py-3">
                <dt className="text-sm text-muted-foreground">Total</dt>
                <dd className="text-sm font-bold">{formatBRL(order.total)}</dd>
              </div>
            </>
          )}
          {isTableOrder && (
            <>
              <div className="flex items-center justify-between py-3">
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant={order ? ORDER_STATUS_META[order.status]?.variant ?? "secondary" : "secondary"}>
                    {statusLabel}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="text-sm text-muted-foreground">Tempo estimado</dt>
                <dd className="text-sm font-medium">
                  {waitingCounter
                    ? "Pague no caixa para iniciar o preparo"
                    : awaitingPayment
                      ? "Após a confirmação do pagamento"
                      : "30–40 min"}
                </dd>
              </div>
            </>
          )}
        </dl>
      </div>

      <div className="mt-4 space-y-2">
        {isTableOrder && (
          <Button className="w-full" size="lg" onClick={() => navigate({ to: "/c/$companySlug/meus-pedidos", params: { companySlug } })}>
            Acompanhar Pedido
          </Button>
        )}
        <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/c/$companySlug/feed", params: { companySlug } })}>
          Voltar ao catálogo
        </Button>
      </div>
    </div>
  );
}

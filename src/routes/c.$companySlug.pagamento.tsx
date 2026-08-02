import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { companyRepository, orderRepository } from "@/repositories";
import { getSessionForCompany, getAnonymousId, type WeazeSession } from "@/lib/session";
import { onboardViaQr } from "@/lib/qr-onboard";
import { useCart } from "@/hooks/use-cart";
import { CheckoutStepper } from "@/components/checkout-stepper";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { readCheckoutDraft, clearCheckoutDraft } from "@/lib/checkout-draft";
import type { PaymentMethod } from "@/repositories/types";
import { paymentService } from "@/services/payment";
import { CreditCard, QrCode, Store } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";

export const Route = createFileRoute("/c/$companySlug/pagamento")({
  component: PaymentPage,
  head: () => ({ meta: [{ title: "Forma de pagamento" }] }),
});

const STEPS = ["Resumo", "Forma de pagamento", "Pedido enviado"];
const SDK_URL = "https://sdk.mercadopago.com/js/v2";

interface MercadoPagoPaymentResult {
  status: string;
  payment_id: string;
}

interface MercadoPagoBrickController {
  submit: () => Promise<MercadoPagoPaymentResult>;
}

declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      options?: { locale: string },
    ) => {
      bricks: () => {
        builder: () => {
          create: (
            brick: "payment",
            container: string,
            options: unknown,
          ) => Promise<MercadoPagoPaymentResult>;
        };
      };
    };
    __mpBricksPendingSubmit?: { resolve: () => void; reject: (e: unknown) => void };
    __mpBricksController?: MercadoPagoBrickController;
  }
}

const METHODS: { key: PaymentMethod; label: string; description: string; icon: typeof QrCode; available: boolean }[] = [
  { key: "pix", label: "Pix", description: "Pague pelo app em segundos", icon: QrCode, available: true },
  { key: "card", label: "Cartão", description: "Débito ou crédito", icon: CreditCard, available: true },
  { key: "counter", label: "Pagamento no Caixa", description: "Pague direto no caixa do estabelecimento", icon: Store, available: true },
];

function loadMercadoPagoSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.MercadoPago) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar o Mercado Pago.")));
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar o Mercado Pago."));
    document.head.appendChild(script);
  });
}

function PaymentPage() {
  const { companySlug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [session, setSession] = useState<WeazeSession | null>(() =>
    typeof window !== "undefined" ? getSessionForCompany(companySlug) : null,
  );
  const [onboarding, setOnboarding] = useState(false);
  const [selected, setSelected] = useState<PaymentMethod>("counter");
  const [startingPayment, setStartingPayment] = useState(false);
  const [onlineUnavailable, setOnlineUnavailable] = useState(false);
  const bricksContainerRef = useRef<HTMLDivElement>(null);

  const { data: company } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
  });
  const cart = useCart(company?.id);

  const { data: mpConfig } = useQuery({
    queryKey: ["mp-config"],
    queryFn: () => paymentService.checkout.config(),
    enabled: !!company,
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

  const isOnline = selected === "pix" || selected === "card";
  const onlineAvailable = mpConfig?.configured === true && !onlineUnavailable;

  const finishOnlinePayment = async (
    companyId: string,
    orderId: string,
    result: MercadoPagoPaymentResult,
  ) => {
    await paymentService.checkout.confirmOrder(companyId, orderId, result.payment_id);
    clearCheckoutDraft(companyId);
    cart.clear();
    qc.invalidateQueries({ queryKey: ["orders"] });
    navigate({
      to: "/c/$companySlug/confirmado",
      params: { companySlug },
      search: { orderId, paymentId: result.payment_id, status: result.status },
    });
  };

  const startPayment = useMutation({
    mutationFn: async () => {
      if (!company || !session) throw new Error("Sessão inválida");
      if (cart.items.length === 0) throw new Error("Sacola vazia");
      const draft = readCheckoutDraft(company.id);

      if (isOnline) {
        if (!onlineAvailable) throw new Error("Pagamento online indisponível neste momento.");
        const order = await orderRepository.create({
          companyId: company.id,
          customerId: session.customerId,
          sessionToken: session.sessionToken,
          tableId: null,
          note: draft.note,
          paymentMethod: selected,
          paymentProvider: "mercadopago",
          sessionId: getAnonymousId(),
          items: cart.items,
        });
        const pref = await paymentService.checkout.createPreference(company.id, order.id);

        await loadMercadoPagoSdk();
        if (!window.MercadoPago || !bricksContainerRef.current) {
          throw new Error("Pagamento online indisponível neste momento.");
        }
        if (mpConfig?.configured !== true || !mpConfig.publicKey) {
          throw new Error("Pagamento online indisponível neste momento.");
        }

        const mp = new window.MercadoPago(mpConfig.publicKey, { locale: "pt-BR" });
        const builder = mp.bricks().builder();

        const result = await builder.create("payment", "#weaze-mp-bricks", {
          initialization: { preferenceId: pref.preferenceId },
          callbacks: {
            onReady: () => undefined,
            onSubmit: () =>
              new Promise<void>((resolve, reject) => {
                window.__mpBricksPendingSubmit = { resolve, reject };
              }),
            onError: (error: unknown) => {
              window.__mpBricksPendingSubmit?.reject(error);
              window.__mpBricksPendingSubmit = undefined;
            },
          },
        });

        window.__mpBricksPendingSubmit?.resolve();
        window.__mpBricksPendingSubmit = undefined;

        if (result.status === "approved" || result.status === "pending") {
          await finishOnlinePayment(company.id, order.id, result);
        } else {
          throw new Error("Pagamento não concluído. Tente novamente ou pague no caixa.");
        }
        return;
      }

      const res = await orderRepository.create({
        companyId: company.id,
        customerId: session.customerId,
        sessionToken: session.sessionToken,
        tableId: null,
        note: draft.note,
        paymentMethod: "counter",
        paymentProvider: "counter",
        sessionId: getAnonymousId(),
        items: cart.items,
      });
      return { orderId: res.id };
    },
    onSuccess: (res) => {
      if (!res) return;
      toast.success("Pedido enviado! O estabelecimento foi notificado.");
      if (company) clearCheckoutDraft(company.id);
      cart.clear();
      qc.invalidateQueries({ queryKey: ["orders"] });
      navigate({
        to: "/c/$companySlug/confirmado",
        params: { companySlug },
        search: { orderId: res.orderId, paymentId: undefined, status: undefined },
      });
    },
    onError: (e: any) => {
      if (isOnline) setOnlineUnavailable(true);
      toast.error(e?.message ?? "Não foi possível concluir o pedido.");
    },
  });

  if (!session) {
    if (onboarding) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="animate-pulse text-sm text-muted-foreground">Preparando o pagamento...</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold">Forma de pagamento</h1>

      <CheckoutStepper steps={STEPS} current={1} />

      <div className="space-y-2">
        {METHODS.map(({ key, label, description, icon: Icon, available }) => {
          const active = selected === key;
          const canUse = available && (key === "counter" || onlineAvailable);
          return (
            <button
              key={key}
              type="button"
              disabled={!canUse}
              onClick={() => {
                setSelected(key);
                setOnlineUnavailable(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition ${
                !canUse
                  ? "opacity-60"
                  : active
                    ? "border-primary ring-1 ring-primary"
                    : "hover:border-border/70"
              }`}
            >
              <Icon className="size-6 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {!available
                    ? "Disponível em breve"
                    : canUse
                      ? description
                      : "Indisponível — contate o estabelecimento"}
                </p>
              </div>
              <div
                className={`grid size-5 place-items-center rounded-full border ${
                  active ? "border-primary bg-primary" : "border-border"
                }`}
              >
                {active && <div className="size-2 rounded-full bg-primary-foreground" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total a pagar</span>
          <span className="text-lg font-bold">{formatBRL(cart.total)}</span>
        </div>
      </div>

      {isOnline && onlineAvailable && (
        <div
          ref={bricksContainerRef}
          id="weaze-mp-bricks"
          className="mt-4"
          aria-live="polite"
        />
      )}

      <Button
        className="mt-4 w-full"
        size="lg"
        disabled={startPayment.isPending || cart.items.length === 0}
        onClick={() => startPayment.mutate()}
      >
        {startPayment.isPending
          ? isOnline
            ? "Aguardando pagamento…"
            : "Enviando pedido…"
          : isOnline
            ? "Pagar agora"
            : "Confirmar pedido"}
      </Button>
    </div>
  );
}

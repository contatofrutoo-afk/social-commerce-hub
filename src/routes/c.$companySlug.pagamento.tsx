import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { companyRepository, customerRepository, orderRepository } from "@/repositories";
import { getSessionForCompany, getAnonymousId, clearSession, type WeazeSession } from "@/lib/session";
import { onboardViaQr } from "@/lib/qr-onboard";
import { useCart } from "@/hooks/use-cart";
import { CheckoutStepper } from "@/components/checkout-stepper";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { readCheckoutDraft, clearCheckoutDraft } from "@/lib/checkout-draft";
import { readCheckoutItems, clearCheckoutItems } from "@/lib/checkout-items";
import type { PaymentMethod } from "@/repositories/types";
import { paymentService, type CreatePixPaymentResult } from "@/services/payment";
import { Check, Copy, CreditCard, Loader2, QrCode, RefreshCcw, Store } from "lucide-react";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

interface CardPaymentFormData {
  token: string;
  installments?: number;
  payment_method_id: string;
  payer?: { email?: string; identification?: { type?: string; number?: string } };
}

declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      options?: { locale: string },
    ) => {
      bricks: () => {
        create: (
          brick: "payment",
          container: string,
          settings: {
            initialization: { amount: number };
            customization?: { paymentMethods?: Record<string, string> };
            callbacks: {
              onReady: () => void;
              onSubmit: (input: { formData: CardPaymentFormData }) => Promise<void>;
              onError: (error: { type: string; message: string }) => void;
            };
          },
        ) => Promise<{ unmount: () => void }>;
      };
    };
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
  const mpBrickControllerRef = useRef<{ unmount: () => void } | null>(null);
  const [pixPayment, setPixPayment] = useState<CreatePixPaymentResult | null>(null);
  const [pixOrderId, setPixOrderId] = useState<string | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [pixRemaining, setPixRemaining] = useState(0);
  const [copiedPixCode, setCopiedPixCode] = useState(false);

  const { data: company } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
  });
  const cart = useCart(company?.id);
  const clearCart = cart.clear;

  const checkoutKeys = useMemo(
    () => (company ? readCheckoutItems(company.id) : []),
    [company],
  );

  const filteredItems = useMemo(() => {
    if (checkoutKeys.length === 0) return cart.items;
    return cart.items.filter((i) => checkoutKeys.includes(i.key));
  }, [cart.items, checkoutKeys]);

  const filteredTotal = filteredItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const removePurchasedItems = useCallback(() => {
    if (!company) return;
    for (const key of checkoutKeys) {
      cart.setQty(key, 0);
    }
    clearCheckoutItems(company.id);
  }, [company, checkoutKeys, cart]);

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

  const finishOnlinePayment = useCallback(
    async (companyId: string, orderId: string, result: MercadoPagoPaymentResult) => {
      await paymentService.checkout.confirmOrder(companyId, orderId, result.payment_id);
      clearCheckoutDraft(companyId);
      removePurchasedItems();
      qc.invalidateQueries({ queryKey: ["orders"] });
      navigate({
        to: "/c/$companySlug/confirmado",
        params: { companySlug },
        search: { orderId, paymentId: result.payment_id, status: result.status },
      });
    },
    [companySlug, qc, removePurchasedItems, navigate],
  );

  useEffect(() => {
    return () => {
      mpBrickControllerRef.current?.unmount();
      mpBrickControllerRef.current = null;
    };
  }, []);

  // O token da sessão pode ter sido invalidado no servidor (ex.: checkout do
  // staff rotaciona o session_token). Antes de pagar, valida a sessão local e,
  // se o banco a rejeitou, recria a sessão silenciosamente para o pedido não
  // falhar com 'unauthorized'.
  const ensureFreshSession = async (): Promise<WeazeSession> => {
    if (session) {
      try {
        const self = await customerRepository.findSelf(session.customerId, session.sessionToken);
        if (self) return session;
      } catch (e) {
        const msg = String((e as Error)?.message ?? e).toLowerCase();
        if (!msg.includes("unauthorized")) throw e;
      }
      clearSession();
    }
    const fresh = await onboardViaQr({
      companyId: company!.id,
      companySlug,
      tableId: null,
      source: "link",
    });
    setSession(fresh);
    return fresh;
  };

  const startPayment = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("Sessão inválida");
      if (filteredItems.length === 0) throw new Error("Nenhum item selecionado");
      const active = await ensureFreshSession();
      const draft = readCheckoutDraft(company.id);

      if (isOnline) {
        if (!onlineAvailable) throw new Error("Pagamento online indisponível neste momento.");
        const order = await orderRepository.create({
          companyId: company.id,
          customerId: active.customerId,
          sessionToken: active.sessionToken,
          tableId: null,
          note: draft.note,
          paymentMethod: selected,
          paymentProvider: "mercadopago",
          sessionId: getAnonymousId(),
          items: filteredItems,
        });

        if (selected === "pix") {
          const pix = await paymentService.checkout.createPix(company.id, order.id);
          return { orderId: order.id, pix };
        }

        const pref = await paymentService.checkout.createPreference(company.id, order.id);

        await loadMercadoPagoSdk();
        if (!window.MercadoPago || !bricksContainerRef.current) {
          throw new Error("Pagamento online indisponível neste momento.");
        }
        if (mpConfig?.configured !== true || !mpConfig.publicKey) {
          throw new Error("Pagamento online indisponível neste momento.");
        }

        const mp = new window.MercadoPago(mpConfig.publicKey, { locale: "pt-BR" });

        mpBrickControllerRef.current?.unmount();
        mpBrickControllerRef.current = null;

        const controller = await mp.bricks().create("payment", "weaze-mp-bricks", {
          initialization: { amount: pref.total },
          customization: {
            paymentMethods: { creditCard: "all", debitCard: "all" },
          },
          callbacks: {
            onReady: () => undefined,
            onSubmit: async ({ formData }) => {
              const res = await paymentService.checkout.processCard(company.id, order.id, {
                token: formData.token,
                installments: formData.installments,
                paymentMethodId: formData.payment_method_id,
                payer: formData.payer,
              });
              if (res.status !== "approved" && res.status !== "pending") {
                throw new Error("Pagamento não aprovado. Tente novamente.");
              }
              await finishOnlinePayment(company.id, order.id, {
                status: res.status,
                payment_id: res.paymentId,
              });
            },
            onError: (error) => {
              console.error("Erro no Payment Brick", error);
            },
          },
        });
        mpBrickControllerRef.current = controller;

        return { orderId: order.id, cardReady: true as const };
      }

      const res = await orderRepository.create({
        companyId: company.id,
        customerId: active.customerId,
        sessionToken: active.sessionToken,
        tableId: null,
        note: draft.note,
        paymentMethod: "counter",
        paymentProvider: "counter",
        sessionId: getAnonymousId(),
        items: filteredItems,
      });
      return { orderId: res.id };
    },
    onSuccess: (res) => {
      if (!res) return;
      if ("cardReady" in res && res.cardReady) return;
      if ("pix" in res && res.pix) {
        setPixOrderId(res.orderId);
        setPixPayment(res.pix);
        setPixError(null);
        return;
      }
      toast.success("Pedido enviado! O estabelecimento foi notificado.");
      if (company) clearCheckoutDraft(company.id);
      removePurchasedItems();
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

  // Polling do Pix: enquanto o QR estiver na tela, consulta o status do
  // pagamento a cada 4s até aprovar/cancelar.
  useEffect(() => {
    if (!company || !pixOrderId || !pixPayment || pixError) return;
    let stopped = false;
    const interval = setInterval(async () => {
      if (stopped) return;
      try {
        const res = await paymentService.checkout.getStatus(
          company.id,
          pixOrderId,
          pixPayment.paymentId,
        );
        if (res.status === "approved") {
          stopped = true;
          await finishOnlinePayment(company.id, pixOrderId, {
            status: res.status,
            payment_id: pixPayment.paymentId,
          });
        } else if (res.status === "cancelled" || res.status === "refunded") {
          stopped = true;
          setPixError("O pagamento não foi concluído. Tente novamente ou escolha outra forma.");
        }
      } catch {
        // mantém a verificação — o webhook também atualiza o pedido em paralelo
      }
    }, 4000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [company, pixOrderId, pixPayment, pixError, finishOnlinePayment]);

  // Cronômetro de expiração do Pix.
  useEffect(() => {
    if (!pixPayment) return;
    const expireAt = new Date(pixPayment.expiration).getTime();
    const tick = () => setPixRemaining(Math.max(0, Math.round((expireAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [pixPayment]);

  const copyPixCode = async () => {
    if (!pixPayment) return;
    try {
      await navigator.clipboard.writeText(pixPayment.qrCode);
      setCopiedPixCode(true);
      setTimeout(() => setCopiedPixCode(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o código Pix.");
    }
  };

  const regeneratePix = async () => {
    if (!company || !pixOrderId) return;
    setPixError(null);
    try {
      const pix = await paymentService.checkout.createPix(company.id, pixOrderId);
      setPixPayment(pix);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar um novo Pix.");
    }
  };

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

  const pixTimedOut = pixRemaining <= 0;

  if (pixPayment && selected === "pix") {
    const minutes = Math.floor(pixRemaining / 60);
    const seconds = String(pixRemaining % 60).padStart(2, "0");
    return (
      <div className="p-4">
        <h1 className="mb-4 text-xl font-bold">Pagamento Pix</h1>

        <CheckoutStepper steps={STEPS} current={1} />

        <div className="rounded-xl border bg-card p-5 text-center">
          {!pixError && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Loader2 className="size-3.5 animate-spin" />
              Aguardando pagamento...
            </div>
          )}

          <div className="mx-auto size-52 overflow-hidden rounded-xl border bg-white p-2">
            <img
              src={pixPayment.qrCodeBase64}
              alt="QR Code Pix"
              className="size-full object-contain"
            />
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Escaneie o QR Code com o app do seu banco ou copie o código abaixo.
          </p>

          <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-left">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Pix copia e cola</p>
            <p className="break-all font-mono text-xs">{pixPayment.qrCode}</p>
          </div>

          <Button variant="outline" className="mt-3 w-full" onClick={copyPixCode}>
            {copiedPixCode ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copiedPixCode ? "Código copiado!" : "Copiar código"}
          </Button>

          {pixTimedOut ? (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <p className="font-medium">O tempo do Pix expirou.</p>
              <p className="text-xs">Gere um novo código para tentar novamente.</p>
            </div>
          ) : (
            <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              Válido por{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {minutes}:{seconds}
              </span>
            </p>
          )}

          {(pixTimedOut || pixError) && (
            <Button className="mt-3 w-full" onClick={regeneratePix}>
              <RefreshCcw className="size-4" />
              Gerar novo Pix
            </Button>
          )}

          {pixError && (
            <p className="mt-3 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
              {pixError}
            </p>
          )}

          <button
            type="button"
            className="mt-4 text-xs text-muted-foreground underline"
            onClick={() => {
              setPixPayment(null);
              setPixOrderId(null);
              setPixError(null);
            }}
          >
            Voltar e escolher outra forma de pagamento
          </button>
        </div>
      </div>
    );
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
          <span className="text-lg font-bold">{formatBRL(filteredTotal)}</span>
        </div>
      </div>

      {selected === "card" && onlineAvailable && (
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
        disabled={startPayment.isPending || filteredItems.length === 0}
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

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { companyRepository, orderRepository } from "@/repositories";
import { getSessionForCompany, type WeazeSession } from "@/lib/session";
import { onboardViaQr } from "@/lib/qr-onboard";
import { useCart } from "@/hooks/use-cart";
import { CheckoutStepper } from "@/components/checkout-stepper";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { readCheckoutDraft, clearCheckoutDraft } from "@/lib/checkout-draft";
import type { PaymentMethod } from "@/repositories/types";
import { CreditCard, QrCode, Store } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/c/$companySlug/pagamento")({
  component: PaymentPage,
  head: () => ({ meta: [{ title: "Forma de pagamento" }] }),
});

const STEPS = ["Resumo", "Forma de pagamento", "Pedido enviado"];

const METHODS: { key: PaymentMethod; label: string; description: string; icon: typeof QrCode; available: boolean }[] = [
  { key: "pix", label: "Pix", description: "Pague pelo app em segundos", icon: QrCode, available: false },
  { key: "card", label: "Cartão", description: "Débito ou crédito", icon: CreditCard, available: false },
  { key: "counter", label: "Pagamento no Caixa", description: "Pague direto no caixa do estabelecimento", icon: Store, available: true },
];

function PaymentPage() {
  const { companySlug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [session, setSession] = useState<WeazeSession | null>(() =>
    typeof window !== "undefined" ? getSessionForCompany(companySlug) : null,
  );
  const [onboarding, setOnboarding] = useState(false);
  const [selected, setSelected] = useState<PaymentMethod>("counter");

  const { data: company } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
  });
  const cart = useCart(company?.id);

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

  const submit = useMutation({
    mutationFn: async () => {
      if (!company || !session) throw new Error("Sessão inválida");
      if (cart.items.length === 0) throw new Error("Sacola vazia");
      const draft = readCheckoutDraft(company.id);
      return orderRepository.create({
        companyId: company.id,
        customerId: session.customerId,
        sessionToken: session.sessionToken,
        tableId: null,
        note: draft.note,
        paymentMethod: selected,
        items: cart.items,
      });
    },
    onSuccess: (res) => {
      toast.success("Pedido enviado! O estabelecimento foi notificado.");
      if (company) clearCheckoutDraft(company.id);
      cart.clear();
      qc.invalidateQueries({ queryKey: ["orders"] });
      navigate({
        to: "/c/$companySlug/confirmado",
        params: { companySlug },
        search: { orderId: res.id },
      });
    },
    onError: (e: any) => toast.error(e.message),
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
          return (
            <button
              key={key}
              type="button"
              disabled={!available}
              onClick={() => setSelected(key)}
              className={`flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition ${
                !available
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
                  {available ? description : "Disponível em breve"}
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

      <Button
        className="mt-4 w-full"
        size="lg"
        disabled={submit.isPending || cart.items.length === 0}
        onClick={() => submit.mutate()}
      >
        {submit.isPending ? "Enviando pedido…" : "Confirmar pedido"}
      </Button>
    </div>
  );
}

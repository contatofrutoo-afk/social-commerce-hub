import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { companyRepository } from "@/repositories";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckoutStepper } from "@/components/checkout-stepper";
import { formatBRL } from "@/lib/format";
import { readCheckoutDraft, saveCheckoutDraft } from "@/lib/checkout-draft";
import { readCheckoutItems } from "@/lib/checkout-items";
import { useState, useMemo } from "react";
import { OrderItemOptions } from "@/components/product-options-selector";

export const Route = createFileRoute("/c/$companySlug/checkout")({
  component: CheckoutPage,
  head: () => ({ meta: [{ title: "Checkout" }] }),
});

const STEPS = ["Resumo", "Forma de pagamento", "Pedido enviado"];

function CheckoutPage() {
  const { companySlug } = Route.useParams();
  const navigate = useNavigate();
  const { data: company } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
  });
  const cart = useCart(company?.id);
  const [note, setNote] = useState(() =>
    typeof window !== "undefined" && company ? readCheckoutDraft(company.id).note ?? "" : "",
  );

  const checkoutKeys = useMemo(
    () => (company ? readCheckoutItems(company.id) : []),
    [company],
  );

  const filteredItems = useMemo(() => {
    if (checkoutKeys.length === 0) return cart.items;
    return cart.items.filter((i) => checkoutKeys.includes(i.key));
  }, [cart.items, checkoutKeys]);

  const filteredTotal = filteredItems.reduce((s, i) => s + i.price * i.quantity, 0);

  function handleContinue() {
    if (!company) return;
    saveCheckoutDraft(company.id, { note });
    navigate({ to: "/c/$companySlug/pagamento", params: { companySlug } });
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold">Checkout</h1>

      <CheckoutStepper steps={STEPS} current={0} />

      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum item selecionado.</p>
            <Button className="mt-4" variant="outline" onClick={() => navigate({ to: "/c/$companySlug/sacola", params: { companySlug } })}>
              Voltar à sacola
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">Resumo do pedido</h2>
              <div className="space-y-2">
                {filteredItems.map((i) => (
                  <div key={i.key} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        {i.name} <span className="text-muted-foreground">× {i.quantity}</span>
                      </span>
                      <span className="font-medium">{formatBRL(i.price * i.quantity)}</span>
                    </div>
                    <OrderItemOptions options={i.options} className="mt-0.5" />
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-2 text-sm font-bold">
                  <span>Total</span>
                  <span>{formatBRL(filteredTotal)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">Observação do pedido</h2>
              <Textarea
                placeholder="Ex.: sem cebola, ponto da carne, mais capricho no molho..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
              />
            </div>

            <Button className="w-full" size="lg" onClick={handleContinue}>
              Continuar para pagamento
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { companyRepository } from "@/repositories";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckoutStepper } from "@/components/checkout-stepper";
import { formatBRL } from "@/lib/format";
import { readCheckoutDraft, saveCheckoutDraft } from "@/lib/checkout-draft";
import { useState } from "react";
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
        {cart.items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum item na sacola.</p>
            <Button className="mt-4" variant="outline" onClick={() => navigate({ to: "/c/$companySlug/feed", params: { companySlug } })}>
              Ver catálogo
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">Resumo do pedido</h2>
              <div className="space-y-2">
                {cart.items.map((i) => (
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
                  <span>{formatBRL(cart.total)}</span>
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

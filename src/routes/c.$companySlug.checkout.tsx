import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { companyRepository } from "@/repositories";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { CreditCard, QrCode, Store, Check } from "lucide-react";

export const Route = createFileRoute("/c/$companySlug/checkout")({
  component: CheckoutPage,
  head: () => ({ meta: [{ title: "Checkout" }] }),
});

const STEPS = ["Resumo", "Forma de pagamento", "Pagamento", "Pedido confirmado"];

const METHODS = [
  { key: "pix", label: "Pix", icon: QrCode },
  { key: "card", label: "Cartão", icon: CreditCard },
  { key: "counter", label: "Pagamento no Caixa", icon: Store },
];

function CheckoutPage() {
  const { companySlug } = Route.useParams();
  const { data: company } = useQuery({
    queryKey: ["company", companySlug],
    queryFn: () => companyRepository.findBySlug(companySlug),
  });
  const cart = useCart(company?.id);

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold">Checkout</h1>

      <div className="mb-6 flex items-center justify-between">
        {STEPS.map((step, i) => (
          <div key={step} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`grid size-6 place-items-center rounded-full text-xs font-bold ${
                  i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {i === 0 ? <Check className="size-3.5" /> : i + 1}
              </div>
              <span className={`text-xs ${i === 0 ? "font-semibold" : "text-muted-foreground"}`}>
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {cart.items.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">Nenhum item na sacola.</p>
        ) : (
          <div className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Resumo do pedido</h2>
            <div className="space-y-2">
              {cart.items.map((i) => (
                <div key={i.productId} className="flex items-center justify-between text-sm">
                  <span>
                    {i.name} <span className="text-muted-foreground">× {i.quantity}</span>
                  </span>
                  <span className="font-medium">{formatBRL(i.price * i.quantity)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-2 text-sm font-bold">
                <span>Total</span>
                <span>{formatBRL(cart.total)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Forma de pagamento</h2>
          <div className="space-y-2">
            {METHODS.map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center gap-3 rounded-lg border p-3 opacity-60">
                <Icon className="size-5 text-muted-foreground" />
                <span className="flex-1 text-sm">{label}</span>
                <span className="text-xs text-muted-foreground">Disponível em breve</span>
              </div>
            ))}
          </div>
        </div>

        <Button className="w-full" size="lg" disabled>
          Continuar para pagamento
        </Button>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CreditCard, QrCode, Store } from "lucide-react";

export const Route = createFileRoute("/c/$companySlug/pagamento")({
  component: PaymentPage,
  head: () => ({ meta: [{ title: "Pagamento" }] }),
});

const METHODS = [
  { key: "pix", label: "Pix", icon: QrCode },
  { key: "card", label: "Cartão", icon: CreditCard },
  { key: "counter", label: "Pagamento no Caixa", icon: Store },
];

function PaymentPage() {
  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold">Pagamento</h1>

      <div className="space-y-2">
        {METHODS.map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 opacity-60"
          >
            <Icon className="size-6 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">Disponível em breve</p>
            </div>
          </div>
        ))}
      </div>

      <Button className="mt-4 w-full" size="lg" disabled>
        Confirmar pagamento
      </Button>
    </div>
  );
}

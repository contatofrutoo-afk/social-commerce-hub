import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/c/$companySlug/confirmado")({
  component: OrderConfirmedPage,
  head: () => ({ meta: [{ title: "Pedido confirmado" }] }),
});

function OrderConfirmedPage() {
  return (
    <div className="p-4">
      <div className="flex flex-col items-center py-10 text-center">
        <CheckCircle2 className="size-16 text-emerald-500" />
        <h1 className="mt-4 text-xl font-bold">Pedido confirmado!</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe o status do seu pedido em tempo real.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <dl className="divide-y">
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-muted-foreground">Pedido</dt>
            <dd className="text-sm font-medium">#0000</dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-muted-foreground">Status</dt>
            <dd>
              <Badge>Recebido</Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-muted-foreground">Tempo estimado</dt>
            <dd className="text-sm font-medium">30–40 min</dd>
          </div>
        </dl>
      </div>

      <Button className="mt-4 w-full" size="lg">
        Acompanhar Pedido
      </Button>
    </div>
  );
}

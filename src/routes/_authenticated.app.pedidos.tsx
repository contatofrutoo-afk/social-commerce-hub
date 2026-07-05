import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { orderRepository } from "@/repositories";
import type { Order } from "@/repositories/types";
import { Button } from "@/components/ui/button";
import { formatBRL, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/pedidos")({
  component: OrdersPage,
});

function OrdersPage() {
  const qc = useQueryClient();
  const { data: companyId } = useQuery({
    queryKey: ["my-company-id"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("company_id").limit(1).maybeSingle();
      return data?.company_id as string | undefined;
    },
  });
  const { data: orders } = useQuery({
    queryKey: ["orders", companyId],
    queryFn: () => orderRepository.listByCompany(companyId!),
    enabled: !!companyId,
    refetchInterval: 10000,
  });

  const advance = useMutation({
    mutationFn: (id: string) => orderRepository.updateStatus(id, "completed"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });

  const received = orders?.filter((o) => o.status === "received") ?? [];
  const completed = orders?.filter((o) => o.status === "completed") ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pedidos</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Column title="Recebidos" orders={received} action={advance} actionLabel="Concluir" />
        <Column title="Concluídos" orders={completed} />
      </div>
    </div>
  );
}

function Column({
  title,
  orders,
  action,
  actionLabel,
}: {
  title: string;
  orders: Order[];
  action?: { mutate: (id: string) => void };
  actionLabel?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">
        {title} <span className="text-muted-foreground">({orders.length})</span>
      </h3>
      <div className="space-y-2">
        {orders.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pedido</p>
        )}
        {orders.map((o) => (
          <div key={o.id} className="rounded-lg border p-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {o.customerName ?? "Cliente"}
                {o.tableLabel && <span className="ml-2 text-xs text-primary">· {o.tableLabel}</span>}
              </span>
              <span className="font-bold">{formatBRL(o.total)}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {o.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ")}
            </div>
            {o.note && <div className="mt-1 text-xs italic">"{o.note}"</div>}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{relativeTime(o.createdAt)}</span>
              {action && (
                <Button size="sm" onClick={() => action.mutate(o.id)}>
                  {actionLabel}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { orderRepository, customerRepository } from "@/repositories";
import type { Order } from "@/repositories/types";
import { Button } from "@/components/ui/button";
import { formatBRL, relativeTime, formatDateTime } from "@/lib/format";
import { User, Clock, Heart, Users, Home, RefreshCw, Sparkles, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/pedidos")({
  component: OrdersPage,
});

function OrdersPage() {
  const qc = useQueryClient();
  const { data: companyId } = useQuery({
    queryKey: ["my-company-id"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("company_id")
        .limit(1)
        .maybeSingle();
      return data?.company_id as string | undefined;
    },
  });
  const { data: orders } = useQuery({
    queryKey: ["orders", companyId],
    queryFn: () => orderRepository.listByCompany(companyId!),
    enabled: !!companyId,
    refetchInterval: 10000,
  });
  const { data: checkins } = useQuery({
    queryKey: ["checkins-all", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("checkins")
        .select("id, customer_id, context, created_at, table_id")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });
  const { data: customers } = useQuery({
    queryKey: ["customers", companyId],
    queryFn: () => customerRepository.listByCompany(companyId!),
    enabled: !!companyId,
  });

  const advance = useMutation({
    mutationFn: (id: string) => orderRepository.updateStatus(id, "completed"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => orderRepository.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });

  const customersById = new Map(customers?.map((c) => [c.id, c]) ?? []);

  // Enrich orders with customer visit info and context
  const enrichedOrders = (orders ?? []).map((o) => {
    const customer = customersById.get(o.customerId);
    const customerCheckins = (checkins ?? []).filter((c: any) => c.customer_id === o.customerId);
    const orderTime = new Date(o.createdAt).getTime();

    // Find closest check-in before the order
    let closestCheckin: any = null;
    let minDiff = Infinity;
    customerCheckins.forEach((c: any) => {
      const diff = orderTime - new Date(c.created_at).getTime();
      if (diff >= 0 && diff < minDiff) {
        minDiff = diff;
        closestCheckin = c;
      }
    });

    const isNew = customer ? customer.visitCount <= 1 : false;
    const isReturning = customer && !isNew;
    const checkinToOrderHours = closestCheckin ? minDiff / 3600000 : null;

    return {
      ...o,
      context: closestCheckin?.context ?? null,
      checkinToOrderHours,
      isNew,
      isReturning,
    };
  });

  const received = enrichedOrders.filter((o) => o.status === "received") ?? [];
  const completed = enrichedOrders.filter((o) => o.status === "completed") ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pedidos</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Column
          title="Recebidos"
          orders={received}
          action={advance}
          actionLabel="Concluir"
          onDelete={remove}
        />
        <Column title="Concluídos" orders={completed} onDelete={remove} />
      </div>
    </div>
  );
}

const contextIcons: Record<string, any> = {
  sozinho: User,
  casal: Heart,
  amigos: Users,
  familia: Home,
};

function Column({
  title,
  orders,
  action,
  actionLabel,
  onDelete,
}: {
  title: string;
  orders: any[];
  action?: { mutate: (id: string) => void };
  actionLabel?: string;
  onDelete?: { mutate: (id: string) => void };
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
        {orders.map((o: any) => {
          const ContextIcon = o.context ? contextIcons[o.context] : null;
          return (
            <div key={o.id} className="rounded-lg border p-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {o.customerName ?? "Cliente"}
                  {o.tableLabel && (
                    <span className="ml-2 text-xs text-primary">· {o.tableLabel}</span>
                  )}
                </span>
                <span className="font-bold">{formatBRL(o.total)}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {o.items.map((i: any) => `${i.quantity}× ${i.productName}`).join(", ")}
              </div>
              {o.note && <div className="mt-1 text-xs italic">"{o.note}"</div>}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <span title={formatDateTime(o.createdAt)}>{relativeTime(o.createdAt)}</span>
                <span className="text-[9px] opacity-60">{formatDateTime(o.createdAt)}</span>
                {ContextIcon && (
                  <span className="flex items-center gap-0.5 capitalize">
                    <ContextIcon className="size-3" /> {o.context}
                  </span>
                )}
                {o.checkinToOrderHours !== null && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="size-3" /> pedido em {o.checkinToOrderHours.toFixed(1)}h
                  </span>
                )}
                {o.isNew && (
                  <span className="flex items-center gap-0.5 text-primary">
                    <Sparkles className="size-3" /> Novo cliente
                  </span>
                )}
                {o.isReturning && (
                  <span className="flex items-center gap-0.5">
                    <RefreshCw className="size-3" /> Recorrente
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1">
                  {action && (
                    <Button size="sm" onClick={() => action.mutate(o.id)}>
                      {actionLabel}
                    </Button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Excluir pedido de ${o.customerName ?? "Cliente"}?`))
                          onDelete.mutate(o.id);
                      }}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Excluir pedido"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

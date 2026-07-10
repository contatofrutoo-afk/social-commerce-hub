import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { orderRepository, customerRepository } from "@/repositories";
import type { Order, OrderItem } from "@/repositories/types";
import { Button } from "@/components/ui/button";
import { formatBRL, relativeTime, formatDateTime } from "@/lib/format";
import {
  User,
  Clock,
  Heart,
  Users,
  Home,
  RefreshCw,
  Sparkles,
  Trash2,
  CheckCircle2,
  PackageMinus,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/pedidos")({
  component: OrdersPage,
  head: () => ({ meta: [{ title: "Pedidos — WEAZE" }] }),
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
    mutationFn: async (order: Order) => {
      await orderRepository.completeOrder(
        order.id,
        order.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        order.customerId,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => orderRepository.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });

  const removeItem = useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: string; itemId: string }) =>
      orderRepository.deleteOrderItem(orderId, itemId),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      if (result.deleted) {
        toast.success("Pedido removido (sem itens restantes)");
      } else {
        toast.success("Item removido do pedido");
      }
    },
  });

  const customersById = new Map(customers?.map((c) => [c.id, c]) ?? []);

  const enrichedOrders = (orders ?? []).map((o) => {
    const customer = customersById.get(o.customerId);
    const customerCheckins = (checkins ?? []).filter((c: any) => c.customer_id === o.customerId);
    const orderTime = new Date(o.createdAt).getTime();

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
          onRemoveItem={removeItem}
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
  onRemoveItem,
}: {
  title: string;
  orders: any[];
  action?: { mutate: (order: Order) => void; isPending: boolean };
  actionLabel?: string;
  onDelete?: { mutate: (id: string) => void };
  onRemoveItem?: {
    mutate: (vars: { orderId: string; itemId: string }) => void;
    isPending: boolean;
  };
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">
        {title} <span className="text-muted-foreground">({orders.length})</span>
      </h3>
      <div className="space-y-3">
        {orders.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pedido</p>
        )}
        {orders.map((o: any) => (
          <OrderCard
            key={o.id}
            order={o}
            action={action}
            actionLabel={actionLabel}
            onDelete={onDelete}
            onRemoveItem={onRemoveItem}
          />
        ))}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  action,
  actionLabel,
  onDelete,
  onRemoveItem,
}: {
  order: any;
  action?: { mutate: (order: Order) => void; isPending: boolean };
  actionLabel?: string;
  onDelete?: { mutate: (id: string) => void };
  onRemoveItem?: {
    mutate: (vars: { orderId: string; itemId: string }) => void;
    isPending: boolean;
  };
}) {
  const [removedItemIds, setRemovedItemIds] = useState<Set<string>>(new Set());

  const visibleItems = useMemo(
    () => order.items.filter((i: OrderItem) => !removedItemIds.has(i.id)),
    [order.items, removedItemIds],
  );

  const currentTotal = useMemo(
    () => visibleItems.reduce((s: number, i: OrderItem) => s + i.quantity * i.unitPrice, 0),
    [visibleItems],
  );

  const ContextIcon = order.context ? contextIcons[order.context] : null;

  const handleRemoveItem = (itemId: string) => {
    setRemovedItemIds((prev) => new Set(prev).add(itemId));
    onRemoveItem?.mutate({ orderId: order.id, itemId });
  };

  const handleConcluir = () => {
    if (visibleItems.length === 0) {
      toast.error("Remova o pedido — não há itens restantes");
      return;
    }
    action?.mutate({
      ...order,
      items: visibleItems,
    });
  };

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">
          {order.customerName ?? "Cliente"}
          {order.tableLabel && (
            <span className="ml-2 text-xs text-primary">· {order.tableLabel}</span>
          )}
        </span>
        <span className="font-bold">{formatBRL(currentTotal)}</span>
      </div>

      <div className="space-y-1">
        {visibleItems.map((item: OrderItem) => {
          const lineTotal = item.quantity * item.unitPrice;
          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs"
            >
              <div className="flex-1 min-w-0">
                <span className="font-medium truncate block">{item.productName}</span>
                <span className="text-muted-foreground">
                  {item.quantity}× {formatBRL(item.unitPrice)} = {formatBRL(lineTotal)}
                </span>
              </div>
              {onRemoveItem && (
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  disabled={onRemoveItem.isPending}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                  title={`Remover ${item.productName}`}
                >
                  <PackageMinus className="size-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {visibleItems.length === 0 && (
          <p className="py-2 text-center text-xs text-muted-foreground italic">
            Todos os itens foram removidos
          </p>
        )}
      </div>

      {order.total !== currentTotal && visibleItems.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-1">
          <span>Original:</span>
          <span className="line-through">{formatBRL(order.total)}</span>
        </div>
      )}

      {order.note && <div className="text-xs italic text-muted-foreground">"{order.note}"</div>}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span title={formatDateTime(order.createdAt)}>{relativeTime(order.createdAt)}</span>
        <span className="text-[9px] opacity-60">{formatDateTime(order.createdAt)}</span>
        {ContextIcon && (
          <span className="flex items-center gap-0.5 capitalize">
            <ContextIcon className="size-3" /> {order.context}
          </span>
        )}
        {order.checkinToOrderHours !== null && (
          <span className="flex items-center gap-0.5">
            <Clock className="size-3" /> pedido em {order.checkinToOrderHours.toFixed(1)}h
          </span>
        )}
        {order.isNew && (
          <span className="flex items-center gap-0.5 text-primary">
            <Sparkles className="size-3" /> Novo cliente
          </span>
        )}
        {order.isReturning && (
          <span className="flex items-center gap-0.5">
            <RefreshCw className="size-3" /> Recorrente
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 pt-1 border-t">
        {action && (
          <Button
            size="sm"
            onClick={handleConcluir}
            disabled={action.isPending || visibleItems.length === 0}
            className="gap-1"
          >
            <CheckCircle2 className="size-3.5" />
            {actionLabel}
          </Button>
        )}
        {onDelete && (
          <button
            onClick={() => {
              if (window.confirm(`Excluir pedido de ${order.customerName ?? "Cliente"}?`))
                onDelete.mutate(order.id);
            }}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Excluir pedido"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

import type { OrderStatus, PaymentMethod } from "@/repositories/types";

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  received: { label: "Recebido", variant: "secondary" },
  payment_at_counter: { label: "Pagamento no Caixa", variant: "outline" },
  awaiting_payment: { label: "Aguardando pagamento", variant: "outline" },
  payment_approved: { label: "Pagamento aprovado", variant: "default" },
  preparing: { label: "Preparando", variant: "default" },
  ready: { label: "Pronto", variant: "secondary" },
  delivered: { label: "Entregue", variant: "secondary" },
  completed: { label: "Finalizado", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_META[status]?.label ?? status;
}

export const PAYMENT_METHOD_META: Record<
  PaymentMethod,
  { label: string; shortLabel: string }
> = {
  pix: { label: "Pix", shortLabel: "Pix" },
  card: { label: "Cartão", shortLabel: "Cartão" },
  counter: { label: "Pagamento no Caixa", shortLabel: "No Caixa" },
};

export function paymentMethodLabel(method: PaymentMethod | null | undefined): string {
  if (!method) return "—";
  return PAYMENT_METHOD_META[method]?.label ?? method;
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  received: "preparing",
  payment_at_counter: "preparing",
  awaiting_payment: "payment_approved",
  payment_approved: "preparing",
  preparing: "ready",
  ready: "delivered",
  delivered: "completed",
};

export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
  return NEXT_STATUS[status] ?? null;
}

export const ORDER_ACTION_LABEL: Record<OrderStatus, string | null> = {
  received: "Iniciar preparo",
  payment_at_counter: "Iniciar preparo",
  awaiting_payment: null,
  payment_approved: "Iniciar preparo",
  preparing: "Marcar pronto",
  ready: "Marcar como entregue",
  delivered: "Finalizar",
  completed: null,
  cancelled: null,
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  failed: "Falhou",
  cancelled: "Cancelado",
  refunded: "Estornado",
};

export function paymentStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return PAYMENT_STATUS_LABEL[status] ?? status;
}

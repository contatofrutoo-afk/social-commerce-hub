import { supabase } from "@/integrations/supabase/client";
import type {
  CartItem,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
} from "./types";
import { productRepository } from "./product.repository";

function mapOrder(r: any): Order {
  return {
    id: r.id,
    companyId: r.company_id,
    customerId: r.customer_id,
    customerName: r.customer?.name,
    tableId: r.table_id,
    tableLabel: r.table?.label ?? null,
    status: r.status,
    paymentMethod: (r.payment_method as PaymentMethod) ?? null,
    paymentStatus: (r.payment_status as Order["paymentStatus"]) ?? null,
    paymentProvider: (r.payment_provider as PaymentProvider) ?? null,
    paymentId: r.payment_id ?? null,
    subtotal: r.subtotal != null ? Number(r.subtotal) : null,
    discount: r.discount != null ? Number(r.discount) : null,
    total: Number(r.total),
    note: r.note,
    createdAt: r.created_at,
    items: (r.order_items ?? []).map((i: any) => ({
      id: i.id,
      orderId: i.order_id,
      productId: i.product_id,
      productName: i.product?.name ?? "",
      quantity: i.quantity,
      note: i.note,
      unitPrice: Number(i.unit_price),
      options: (i.order_item_options ?? []).map((o: any) => ({
        optionName: o.option_name,
        valueLabel: o.value_label ?? null,
        quantity: o.quantity ?? 1,
        priceAdjust: o.price_adjust != null ? Number(o.price_adjust) : 0,
        freeText: o.free_text ?? null,
      })),
    })),
  };
}

export const orderRepository = {
  async listByCompany(companyId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `*, customer:customers(name), table:tables(label),
         order_items(*, product:products(name), order_item_options(*))`,
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapOrder);
  },

  async listByCustomer(customerId: string, token: string): Promise<Order[]> {
    const { data, error } = await supabase.rpc("list_customer_orders" as any, {
      _customer_id: customerId,
      _token: token,
    });
    if (error) throw error;
    return ((data ?? []) as any[]).map(mapOrder);
  },

  async create(input: {
    companyId: string;
    customerId: string;
    sessionToken: string;
    tableId?: string | null;
    note?: string;
    paymentMethod?: PaymentMethod;
    paymentProvider?: PaymentProvider;
    sessionId?: string;
    items: CartItem[];
  }): Promise<{ id: string }> {
    const { data, error } = await supabase.rpc("create_customer_order" as any, {
      _customer_id: input.customerId,
      _token: input.sessionToken,
      _company_id: input.companyId,
      _note: input.note ?? null,
      _items: input.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        price: i.price,
        note: i.note ?? null,
        options: (i.options ?? []).map((o) => ({
          optionId: o.optionId,
          valueId: o.valueId ?? null,
          valueLabel: o.valueLabel ?? null,
          quantity: o.quantity ?? 1,
          priceAdjust: o.priceAdjust ?? 0,
          freeText: o.freeText ?? null,
        })),
      })) as any,
      _table_id: input.tableId ?? null,
      _payment_method: input.paymentMethod ?? null,
      _payment_provider: input.paymentProvider ?? null,
      _session_id: input.sessionId ?? null,
    });
    if (error) throw error;
    // Métricas: registra `purchase` para cada item do pedido — alimenta funil
    // e rankings da Inteligência do Catálogo.
    await Promise.all(
      input.items.map((i) =>
        productRepository
          .recordEvent(i.productId, input.companyId, "purchase", input.customerId, {
            order_id: data,
            quantity: i.quantity,
            unit_price: i.price,
          })
          .catch(() => {}),
      ),
    );
    return { id: data as string };
  },

  async updateStatus(id: string, status: OrderStatus) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) throw error;
  },

  /** Exclusão pelo próprio cliente (valida session_token + posse do pedido). */
  async deleteByCustomer(orderId: string, customerId: string, token: string): Promise<void> {
    const { error } = await supabase.rpc("delete_customer_order" as any, {
      _order_id: orderId,
      _customer_id: customerId,
      _token: token,
    });
    if (error) throw error;
  },

  async deleteOrderItem(
    _orderId: string,
    itemId: string,
  ): Promise<{ deleted: boolean; remainingItems: number; newTotal: number }> {
    const { data, error } = await supabase.rpc("delete_order_item" as any, {
      _item_id: itemId,
    });
    if (error) throw error;
    const result = data as { deleted: boolean; remaining_items: number; new_total: number };
    return {
      deleted: result.deleted,
      remainingItems: result.remaining_items,
      newTotal: Number(result.new_total),
    };
  },

  async completeOrder(
    orderId: string,
    _items: { productId: string; quantity: number; unitPrice: number }[],
    _customerId: string,
  ): Promise<void> {
    const { error } = await supabase.rpc("complete_order" as any, {
      _order_id: orderId,
    });
    if (error) throw error;
  },

  /** Conclui de uma vez um pedido de loja (sem mesa): confirma pagamento no
   *  caixa (payment paid) e finaliza o pedido. */
  async finalizeOrder(orderId: string): Promise<void> {
    const { error } = await supabase.rpc("finalize_order" as any, {
      _order_id: orderId,
    });
    if (error) throw error;
  },
};

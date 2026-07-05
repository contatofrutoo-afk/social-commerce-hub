import { supabase } from "@/integrations/supabase/client";
import type { CartItem, Order, OrderStatus } from "./types";

function mapOrder(r: any): Order {
  return {
    id: r.id,
    companyId: r.company_id,
    customerId: r.customer_id,
    customerName: r.customer?.name,
    tableId: r.table_id,
    tableLabel: r.table?.label ?? null,
    status: r.status,
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
    })),
  };
}

export const orderRepository = {
  async listByCompany(companyId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `*, customer:customers(name), table:tables(label),
         order_items(*, product:products(name))`,
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapOrder);
  },

  async listByCustomer(customerId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from("orders")
      .select(`*, table:tables(label), order_items(*, product:products(name))`)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapOrder);
  },

  async create(input: {
    companyId: string;
    customerId: string;
    tableId?: string | null;
    note?: string;
    items: CartItem[];
  }): Promise<Order> {
    const total = input.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        company_id: input.companyId,
        customer_id: input.customerId,
        table_id: input.tableId ?? null,
        note: input.note ?? null,
        total,
        status: "received",
      })
      .select()
      .single();
    if (error) throw error;

    const rows = input.items.map((i) => ({
      order_id: order.id,
      product_id: i.productId,
      quantity: i.quantity,
      unit_price: i.price,
      note: i.note ?? null,
    }));
    const { error: e2 } = await supabase.from("order_items").insert(rows);
    if (e2) throw e2;
    return mapOrder({ ...order, order_items: [] });
  },

  async updateStatus(id: string, status: OrderStatus) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) throw error;
  },
};

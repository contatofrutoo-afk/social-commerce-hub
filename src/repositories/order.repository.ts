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
      })) as any,
      _table_id: input.tableId ?? null,
    });
    if (error) throw error;
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
};

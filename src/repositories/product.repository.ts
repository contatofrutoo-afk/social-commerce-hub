import { supabase } from "@/integrations/supabase/client";
import type { Product, ProductStatus } from "./types";

function map(r: any): Product {
  return {
    id: r.id,
    companyId: r.company_id,
    companySlug: r.company_slug ?? undefined,
    name: r.name,
    slug: r.slug,
    category: r.category,
    price: Number(r.price),
    imageUrl: r.image_url,
    available: r.available,
    description: r.description,
    status: r.status ?? "active",
    stockQuantity: r.stock_quantity,
    sku: r.sku,
    internalCode: r.internal_code,
    viewsCount: r.views_count ?? 0,
    scanCount: r.scan_count ?? 0,
    cartAdditionsCount: r.cart_additions_count ?? 0,
    orderCount: r.order_count ?? 0,
    revenue: Number(r.revenue ?? 0),
    uniqueCustomers: r.unique_customers ?? 0,
  };
}

export const productRepository = {
  async listByCompany(companyId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("company_id", companyId)
      .order("name");
    if (error) throw error;
    return (data ?? []).map(map);
  },

  async findById(id: string): Promise<Product | null> {
    const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? map(data) : null;
  },

  async findBySlug(slug: string): Promise<Product | null> {
    const { data, error } = await supabase.rpc("get_product_public", { _slug: slug });
    if (error) throw error;
    return data ? map(data) : null;
  },

  async create(
    companyId: string,
    p: Omit<Product, "id" | "companyId" | "viewsCount" | "scanCount" | "cartAdditionsCount" | "orderCount" | "revenue" | "uniqueCustomers" | "slug" | "status" | "stockQuantity" | "sku" | "internalCode"> & {
      slug?: string;
      status?: ProductStatus;
      stockQuantity?: number | null;
      sku?: string | null;
      internalCode?: string | null;
    },
  ) {
    const slug = p.slug ?? p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { data, error } = await supabase
      .from("products")
      .insert({
        company_id: companyId,
        name: p.name,
        slug,
        category: p.category,
        price: p.price,
        image_url: p.imageUrl,
        available: p.available,
        description: p.description,
        status: p.status ?? "active" as const,
        stock_quantity: p.stockQuantity ?? null,
        sku: p.sku ?? null,
        internal_code: p.internalCode ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return map(data);
  },

  async update(id: string, p: Partial<Omit<Product, "id" | "companyId" | "viewsCount" | "scanCount" | "cartAdditionsCount" | "orderCount" | "revenue" | "uniqueCustomers">>) {
    const patch: Record<string, unknown> = {};
    if (p.name !== undefined) patch.name = p.name;
    if (p.slug !== undefined) patch.slug = p.slug;
    if (p.category !== undefined) patch.category = p.category;
    if (p.price !== undefined) patch.price = p.price;
    if (p.imageUrl !== undefined) patch.image_url = p.imageUrl;
    if (p.available !== undefined) patch.available = p.available;
    if (p.description !== undefined) patch.description = p.description;
    if (p.status !== undefined) patch.status = p.status;
    if (p.stockQuantity !== undefined) patch.stock_quantity = p.stockQuantity;
    if (p.sku !== undefined) patch.sku = p.sku;
    if (p.internalCode !== undefined) patch.internal_code = p.internalCode;
    const { data, error } = await supabase
      .from("products")
      .update(patch as never)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return map(data);
  },

  async remove(id: string) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
  },

  async recordEvent(
    productId: string,
    companyId: string,
    eventType: string,
    customerId?: string,
    metadata?: Record<string, unknown>,
  ) {
    const { error } = await supabase.rpc("record_product_event", {
      _product_id: productId,
      _company_id: companyId,
      _customer_id: customerId ?? undefined,
      _event_type: eventType,
      _metadata: (metadata ?? {}) as never,
    });
    if (error) throw error;
  },

  async incrementCounter(productId: string, field: string) {
    const { error } = await supabase.rpc("increment_product_counter", {
      _product_id: productId,
      _field: field,
    });
    if (error) throw error;
  },

  async likeToggle(productId: string, customerId: string, token: string, liked: boolean) {
    const { error } = await supabase.rpc("toggle_product_like", {
      _customer_id: customerId,
      _token: token,
      _product_id: productId,
      _liked: liked,
    });
    if (error) throw error;
  },

  async wishToggle(productId: string, customerId: string, token: string, wished: boolean) {
    const { error } = await supabase.rpc("toggle_product_wish", {
      _customer_id: customerId,
      _token: token,
      _product_id: productId,
      _wished: wished,
    });
    if (error) throw error;
  },
};

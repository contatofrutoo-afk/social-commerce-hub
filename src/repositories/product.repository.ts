import { supabase } from "@/integrations/supabase/client";
import type { Product } from "./types";

function map(r: any): Product {
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    category: r.category,
    price: Number(r.price),
    imageUrl: r.image_url,
    available: r.available,
    description: r.description,
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

  async create(companyId: string, p: Omit<Product, "id" | "companyId">) {
    const { data, error } = await supabase
      .from("products")
      .insert({
        company_id: companyId,
        name: p.name,
        category: p.category,
        price: p.price,
        image_url: p.imageUrl,
        available: p.available,
        description: p.description,
      })
      .select()
      .single();
    if (error) throw error;
    return map(data);
  },

  async update(id: string, p: Partial<Omit<Product, "id" | "companyId">>) {
    const { data, error } = await supabase
      .from("products")
      .update({
        name: p.name,
        category: p.category,
        price: p.price,
        image_url: p.imageUrl,
        available: p.available,
        description: p.description,
      })
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

  async likeToggle(productId: string, customerId: string, liked: boolean) {
    if (liked) {
      const { error } = await supabase
        .from("product_likes")
        .delete()
        .eq("product_id", productId)
        .eq("customer_id", customerId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("product_likes")
        .insert({ product_id: productId, customer_id: customerId });
      if (error) throw error;
    }
  },
};

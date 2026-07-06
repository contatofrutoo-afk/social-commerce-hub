import { supabase } from "@/integrations/supabase/client";
import type { Table } from "./types";

const map = (r: any): Table => ({ id: r.id, companyId: r.company_id, label: r.label, slug: r.slug });

export const tableRepository = {
  async listByCompany(companyId: string): Promise<Table[]> {
    const { data, error } = await supabase
      .from("tables")
      .select("*")
      .eq("company_id", companyId)
      .order("label");
    if (error) throw error;
    return (data ?? []).map(map);
  },

  async findBySlug(companyId: string, slug: string): Promise<Table | null> {
    const { data, error } = await supabase
      .from("tables")
      .select("*")
      .eq("company_id", companyId)
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return data ? map(data) : null;
  },

  async create(companyId: string, label: string, slug: string): Promise<Table> {
    const { data, error } = await supabase
      .from("tables")
      .insert({ company_id: companyId, label, slug })
      .select()
      .single();
    if (error) throw error;
    return map(data);
  },

  async update(id: string, patch: { label?: string; slug?: string }): Promise<Table> {
    const { data, error } = await supabase
      .from("tables")
      .update({ label: patch.label, slug: patch.slug })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return map(data);
  },

  async remove(id: string) {
    const { error } = await supabase.from("tables").delete().eq("id", id);
    if (error) throw error;
  },
};

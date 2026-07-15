import { supabase } from "@/integrations/supabase/client";
import type { Table } from "./types";

const map = (r: any): Table => ({ id: r.id, companyId: r.company_id, label: r.label, slug: r.slug });

export const tableRepository = {
  async listByCompany(companyId: string): Promise<Table[]> {
    // Uses public security-definer RPC so both staff and anon (public sales
    // panel at /c/:slug/vendas) can read the tables list.
    const { data, error } = await supabase.rpc("list_service_tables_public" as any, {
      _company_id: companyId,
    });
    if (error) throw error;
    return ((data ?? []) as any[]).map(map);
  },


  async findBySlug(companyId: string, slug: string): Promise<Table | null> {
    const { data, error } = await supabase.rpc("get_table_public", {
      _company_id: companyId,
      _slug: slug,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row ? map(row) : null;
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

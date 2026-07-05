import { supabase } from "@/integrations/supabase/client";
import type { Customer, VisitContext } from "./types";

function map(r: any): Customer {
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    whatsapp: r.whatsapp,
    avatarUrl: r.avatar_url,
    firstVisitAt: r.first_visit_at,
    lastVisitAt: r.last_visit_at,
    visitCount: r.visit_count,
  };
}

export const customerRepository = {
  async findById(id: string): Promise<Customer | null> {
    const { data, error } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? map(data) : null;
  },

  async listByCompany(companyId: string): Promise<Customer[]> {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("company_id", companyId)
      .order("last_visit_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(map);
  },

  /** Cria o cliente ou reutiliza pelo par (company_id, whatsapp), incrementando a visita. */
  async upsertByWhatsapp(input: {
    companyId: string;
    name: string;
    whatsapp: string;
  }): Promise<Customer> {
    const { data: existing } = await supabase
      .from("customers")
      .select("*")
      .eq("company_id", input.companyId)
      .eq("whatsapp", input.whatsapp)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("customers")
        .update({
          name: input.name,
          last_visit_at: new Date().toISOString(),
          visit_count: (existing.visit_count ?? 0) + 1,
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return map(data);
    }

    const { data, error } = await supabase
      .from("customers")
      .insert({ company_id: input.companyId, name: input.name, whatsapp: input.whatsapp })
      .select()
      .single();
    if (error) throw error;
    return map(data);
  },

  async update(id: string, patch: Partial<Pick<Customer, "name" | "whatsapp" | "avatarUrl">>) {
    const { data, error } = await supabase
      .from("customers")
      .update({ name: patch.name, whatsapp: patch.whatsapp, avatar_url: patch.avatarUrl })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return map(data);
  },
};

export const checkinRepository = {
  async create(input: {
    customerId: string;
    companyId: string;
    context: VisitContext;
    tableId?: string | null;
    source?: string;
  }) {
    const { data, error } = await supabase
      .from("checkins")
      .insert({
        customer_id: input.customerId,
        company_id: input.companyId,
        context: input.context,
        table_id: input.tableId ?? null,
        source: input.source ?? "qr",
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listRecentByCompany(companyId: string, limit = 50) {
    const { data, error } = await supabase
      .from("checkins")
      .select("*, customer:customers(name, whatsapp), table:tables(label, slug)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async listPresentByCompany(companyId: string, minutes = 180) {
    const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("checkins")
      .select("*, customer:customers(*), table:tables(label, slug)")
      .eq("company_id", companyId)
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
};

import { supabase } from "@/integrations/supabase/client";
import type { Customer, VisitContext } from "./types";

function map(r: any): Customer {
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    whatsapp: r.whatsapp,
    avatarUrl: r.avatar_url,
    gender: r.gender ?? null,
    ageRange: r.age_range ?? null,
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

  /** Leitura do próprio perfil (inclui whatsapp) autorizada pelo token da sessão. */
  async findSelf(customerId: string, token: string): Promise<Customer | null> {
    const { data, error } = await supabase.rpc("get_customer_self", {
      _customer_id: customerId,
      _token: token,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row ? map(row) : null;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw error;
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

  /** Cria/atualiza o cliente e retorna id + token da sessão via RPC segura. */
  async upsertVisit(input: {
    companyId: string;
    name: string;
    whatsapp: string;
    gender?: string | null;
    ageRange?: string | null;
  }): Promise<{ customerId: string; sessionToken: string }> {
    const { data, error } = await supabase.rpc("upsert_customer_visit", {
      _company_id: input.companyId,
      _name: input.name,
      _whatsapp: input.whatsapp,
      _gender: input.gender ?? undefined,
      _age_range: input.ageRange ?? undefined,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Falha ao registrar cliente");
    return { customerId: row.customer_id, sessionToken: row.session_token };
  },

  /** Atualização do próprio perfil, autorizada pelo token da sessão. */
  async updateSelf(
    customerId: string,
    token: string,
    patch: Partial<Pick<Customer, "name" | "whatsapp" | "avatarUrl" | "gender" | "ageRange">>,
  ) {
    const { error } = await supabase.rpc("update_customer_self", {
      _customer_id: customerId,
      _token: token,
      _name: (patch.name ?? null) as string,
      _whatsapp: (patch.whatsapp ?? null) as string,
      _avatar_url: (patch.avatarUrl ?? null) as string,
      _gender: (patch.gender ?? null) as string,
      _age_range: (patch.ageRange ?? null) as string,
    });
    if (error) throw error;
  },
};

export const checkinRepository = {
  async create(input: {
    customerId: string;
    sessionToken: string;
    companyId: string;
    context: VisitContext;
    tableId?: string | null;
    source?: string;
  }) {
    const { data, error } = await supabase.rpc("create_checkin" as any, {
      _customer_id: input.customerId,
      _token: input.sessionToken,
      _company_id: input.companyId,
      _context: input.context,
      _table_id: input.tableId ?? null,
      _source: input.source ?? "qr",
    });
    if (error) throw error;
    return { id: data as string };
  },

  async listRecentByCompany(companyId: string, limit = 50) {
    const { data, error } = await supabase
      .from("checkins")
      .select("*, table:tables(label, slug)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async deleteByIds(ids: string[]): Promise<void> {
    const { error } = await supabase.from("checkins").delete().in("id", ids);
    if (error) throw error;
  },

  /** Check-in silencioso: cria presenca se ultimo check-in foi ha mais de 4h. */
  async createAutoCheckin(input: {
    customerId: string;
    sessionToken: string;
    companyId: string;
    tableId?: string | null;
    source?: string;
  }): Promise<boolean> {
    const { data, error } = await supabase.rpc("auto_checkin" as any, {
      _customer_id: input.customerId,
      _token: input.sessionToken,
      _company_id: input.companyId,
      _table_id: input.tableId ?? null,
      _source: input.source ?? "link",
    });
    if (error) {
      console.warn("[auto_checkin]", error.message);
      return false;
    }
    return data === true;
  },

  async listPresentByCompany(companyId: string, minutes = 480) {
    // Uses public security-definer RPC so both staff and anon (public sales
    // panel at /c/:slug/vendas) can read the presence snapshot.
    const { data, error } = await supabase.rpc("list_service_present_public" as any, {
      _company_id: companyId,
      _minutes: minutes,
    });
    if (error) throw error;
    // Reshape flat RPC rows into the nested shape the views expect
    // (checkin fields at root, customer nested, table nested).
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      company_id: r.company_id,
      customer_id: r.customer_id,
      table_id: r.table_id,
      context: r.context,
      source: r.source,
      created_at: r.created_at,
      customer: r.customer_id
        ? {
            id: r.customer_id,
            company_id: r.company_id,
            name: r.customer_name,
            avatar_url: r.customer_avatar_url,
            visit_count: r.customer_visit_count,
            first_visit_at: r.customer_first_visit_at,
            last_visit_at: r.customer_last_visit_at,
          }
        : null,
      table: r.table_id ? { label: r.table_label, slug: r.table_slug } : null,
    }));
  },

};

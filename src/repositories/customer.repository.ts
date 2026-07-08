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
  }): Promise<{ customerId: string; sessionToken: string }> {
    const { data, error } = await supabase.rpc("upsert_customer_visit", {
      _company_id: input.companyId,
      _name: input.name,
      _whatsapp: input.whatsapp,
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
    patch: Partial<Pick<Customer, "name" | "whatsapp" | "avatarUrl">>,
  ) {
    const { error } = await supabase.rpc("update_customer_self", {
      _customer_id: customerId,
      _token: token,
      _name: (patch.name ?? null) as string,
      _whatsapp: (patch.whatsapp ?? null) as string,
      _avatar_url: (patch.avatarUrl ?? null) as string,
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

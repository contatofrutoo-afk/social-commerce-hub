import { supabase } from "@/integrations/supabase/client";
import type { Customer, VisitContext } from "./types";

/** Detecta quando o banco rejeita a chamada por não conhecer algum argumento
 *  (ex.: a migration que adiciona `_ip_address` ainda não foi aplicada no
 *  Supabase). Nesse caso as RPCs são chamadas novamente sem o argumento novo. */
function isUnsupportedParamError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  const message = String((error as { message?: unknown } | null)?.message ?? "");
  return code === "PGRST202" || message.includes("Could not find the function");
}

/** Clientes anonimizados pelo "Excluir meus dados" (LGPD) ficam com
 *  name = 'Usuário removido' e whatsapp = 'removido-<uuid>'. Eles não são
 *  clientes ativos: não devem aparecer nas listas (Clientes/Atendimento). */
export function isRemovedCustomer(name: string | null | undefined): boolean {
  return name === "Usuário removido";
}

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
    const { data, error } = await supabase.from("customers").select("id, company_id, name, whatsapp, avatar_url, first_visit_at, last_visit_at, visit_count, created_at").eq("id", id).maybeSingle();
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
      .select("id, company_id, name, whatsapp, avatar_url, first_visit_at, last_visit_at, visit_count, created_at")
      .eq("company_id", companyId)
      .order("last_visit_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(map).filter((c) => !isRemovedCustomer(c.name));
  },

  /** Cria/atualiza o cliente e retorna id + token da sessão via RPC segura. */
  async upsertVisit(input: {
    companyId: string;
    name: string;
    whatsapp: string;
    ip?: string | null;
  }): Promise<{ customerId: string; sessionToken: string }> {
    const args = {
      _company_id: input.companyId,
      _name: input.name,
      _whatsapp: input.whatsapp,
    };
    let { data, error } = await supabase.rpc("upsert_customer_visit", {
      ...args,
      _ip_address: input.ip ?? undefined,
    });
    if (error && isUnsupportedParamError(error)) {
      ({ data, error } = await supabase.rpc("upsert_customer_visit", args));
    }
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Falha ao registrar cliente");
    return { customerId: row.customer_id, sessionToken: row.session_token };
  },

  /** Logout do próprio cliente: encerra o check-in ativo e rotaciona o
   *  session_token no servidor. A saída reflete em tempo real na plataforma
   *  (Atendimento, Dashboard e aba Clientes). */
  async logout(customerId: string, token: string, companyId: string): Promise<void> {
    const { error } = await supabase.rpc("customer_logout" as any, {
      _customer_id: customerId,
      _token: token,
      _company_id: companyId,
    });
    if (error) throw error;
  },

  /** Atualização do próprio perfil, autorizada pelo token da sessão.
   *  Em caso de cadastro duplicado (whatsapp já usado por outro registro da
   *  mesma empresa) a RPC mescla os perfis e devolve o customer_id canônico. */
  async updateSelf(
    customerId: string,
    token: string,
    patch: Partial<Pick<Customer, "name" | "whatsapp" | "avatarUrl">>,
    ip?: string | null,
  ): Promise<{ customerId: string; sessionToken: string }> {
    const args = {
      _customer_id: customerId,
      _token: token,
      _name: (patch.name ?? null) as string,
      _whatsapp: (patch.whatsapp ?? null) as string,
      _avatar_url: (patch.avatarUrl ?? null) as string,
    };
    let { data, error } = await supabase.rpc("update_customer_self", {
      ...args,
      _ip_address: ip ?? undefined,
    });
    if (error && isUnsupportedParamError(error)) {
      ({ data, error } = await supabase.rpc("update_customer_self", args));
    }
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      customerId: row?.customer_id ?? customerId,
      sessionToken: row?.session_token ?? token,
    };
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
    }))
    .filter((r: any) => !r.customer || !isRemovedCustomer(r.customer.name));
  },

  /** Checkout: registra saída do cliente e invalida sessão (rotaciona token). */
  async checkout(customerId: string, companyId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");
    const { error } = await supabase.rpc("checkout_customer" as any, {
      _staff_user_id: user.id,
      _company_id: companyId,
      _customer_id: customerId,
    });
    if (error) throw error;
  },

};

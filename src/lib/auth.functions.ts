import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Garante que o usuário logado tenha acesso a alguma empresa. No MVP,
 * anexa automaticamente à empresa demo se ainda não tiver nenhum role.
 *
 * Usa o cliente autenticado (via RLS) em vez do service role key para
 * viabilizar o fluxo sem depender de SUPABASE_SERVICE_ROLE_KEY.
 */
export const ensureUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;

    const { data: existing } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return { ok: true, alreadyLinked: true };

    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let companyId = company?.id;

    if (!companyId) {
      const slug = `empresa-${userId.slice(0, 8)}`;
      const { data: newCompany } = await supabase
        .from("companies")
        .insert({ name: "Minha Empresa", slug })
        .select("id")
        .single();
      if (!newCompany) return { ok: false };
      companyId = newCompany.id;
    }

    const { error: insertError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, company_id: companyId, role: "owner" });
    if (insertError) return { ok: false, error: insertError.message };

    return { ok: true, companyId };
  });

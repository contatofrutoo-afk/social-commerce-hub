import { supabase } from "@/integrations/supabase/client";

/**
 * Garante que o usuário logado tenha acesso a alguma empresa. No MVP,
 * anexa automaticamente à empresa demo se ainda não tiver nenhum role.
 *
 * Executa no cliente via RLS — não requer server function (que não
 * funciona no deploy Lovable por ser static-only).
 */
export async function ensureUserRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Usuário não autenticado" };

  const { data: existing } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
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
    const slug = `empresa-${user.id.slice(0, 8)}`;
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
    .insert({ user_id: user.id, company_id: companyId, role: "owner" });
  if (insertError) return { ok: false, error: insertError.message };

  return { ok: true, companyId };
}

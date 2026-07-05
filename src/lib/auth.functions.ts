import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Garante que o usuário logado tenha acesso a alguma empresa. No MVP,
 * anexa automaticamente à empresa demo se ainda não tiver nenhum role.
 */
export const ensureUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (existing) return { ok: true, alreadyLinked: true };

    // Vincula à primeira empresa (demo, no MVP)
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
    if (!company) return { ok: false };

    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, company_id: company.id, role: "owner" });
    return { ok: true, companyId: company.id };
  });

import { supabase } from "@/integrations/supabase/client";

/**
 * Garante que o usuário logado tenha uma empresa própria. Delega para a
 * função SECURITY DEFINER `claim_own_company`, que:
 *  - Retorna a empresa existente se o usuário já tiver um role.
 *  - Caso contrário, cria uma nova empresa e atribui o role `owner`.
 *
 * Isso evita que qualquer usuário autenticado possa se auto-atribuir a uma
 * empresa arbitrária via INSERT direto em `user_roles`.
 */
export async function ensureUserRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Usuário não autenticado" };

  const defaultSlug = `empresa-${user.id.slice(0, 8)}`;
  const { data, error } = await supabase.rpc("claim_own_company", {
    _name: "Minha Empresa",
    _slug: defaultSlug,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, companyId: data as string };
}

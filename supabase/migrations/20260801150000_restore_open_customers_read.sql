-- ============================================================
-- Restaura leitura de customers para "como antes".
--
-- Contexto (investigação em produção, 2026-08-01):
--  - O onboarding QR/link sempre criou o cliente em customers
--    com company_id = empresa resolvida pelo slug (upsert_customer_visit).
--  - A aba Clientes sempre leu customers para user_roles.company_id.
--  - A policy atual em produção é de MEMBRO (has_company_access):
--    usuário autenticado sem user_roles vê 0 clientes (testado via API).
--  - As migrations do repo declaram o contrário: 20260707110000
--    criou "Anyone can read customers" USING(true) e nenhuma migration
--    posterior re-trancou a leitura em produção.
--  - Resultado: staff não vinculado via user_roles vê Clientes vazio,
--    mas vê a Loja (lida por RPC SECURITY DEFINER, que ignora RLS).
--
-- Correção: garantir a policy aberta de SELECT para authenticated
-- (idêntica à intenção da 20260707110000), idempotente.
-- NÃO conceder SELECT a anon (produção não tem grant; manter trancado).
-- ============================================================

DROP POLICY IF EXISTS "Company members read customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can read customers" ON public.customers;

CREATE POLICY "Anyone can read customers"
  ON public.customers FOR SELECT TO authenticated
  USING (true);

-- Garante o grant coluna-a-coluna que a aba Clientes usa
-- (mesma lista de 20260710201420). Idempotente.
GRANT SELECT (id, company_id, name, whatsapp, avatar_url,
              first_visit_at, last_visit_at, visit_count, created_at)
  ON public.customers TO authenticated;

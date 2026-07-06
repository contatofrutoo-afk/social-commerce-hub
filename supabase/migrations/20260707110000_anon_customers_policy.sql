-- =========================
-- Permite que clientes anônimos (anon) façam check-in
-- O upsertByWhatsapp precisa de SELECT + INSERT + UPDATE
-- =========================

-- Remove as policies restritivas feitas pela migration 20260706001131
DROP POLICY IF EXISTS "Company members read customers" ON public.customers;
DROP POLICY IF EXISTS "Company members update customers" ON public.customers;

-- Reverte REVOKE da migration 20260706001131
GRANT SELECT, INSERT, UPDATE ON public.customers TO anon;

-- Policies para anon (público) poderem se registrar
CREATE POLICY "Anyone can read customers" ON public.customers
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert customers" ON public.customers
  FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id));

CREATE POLICY "Anyone can update customers" ON public.customers
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

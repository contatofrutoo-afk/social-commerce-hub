-- =========================
-- Permite que membros da empresa (authenticated) excluam clientes
-- O ON DELETE CASCADE cuidará das tabelas relacionadas
-- =========================

CREATE POLICY "Company members delete customers" ON public.customers
  FOR DELETE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

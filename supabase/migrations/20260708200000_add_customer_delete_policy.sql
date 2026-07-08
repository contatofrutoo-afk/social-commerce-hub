-- =========================
-- Permite que membros da empresa (authenticated) excluam clientes
-- Usa subquery direta em vez da função has_company_access (pode não existir)
-- O ON DELETE CASCADE cuidará das tabelas relacionadas
-- =========================

CREATE POLICY "Company members delete customers" ON public.customers
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND company_id = customers.company_id
    )
  );

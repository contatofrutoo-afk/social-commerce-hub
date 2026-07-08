-- =========================
-- Permite que membros da empresa (authenticated) excluam pedidos
-- Usa subquery direta em vez da função has_company_access (pode não existir)
-- =========================

CREATE POLICY "Company members delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND company_id = orders.company_id
    )
  );

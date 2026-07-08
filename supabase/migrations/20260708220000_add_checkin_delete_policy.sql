-- =========================
-- Permite que membros da empresa (authenticated) excluam check-ins
-- Usado pela ação "Liberar mesa" no painel de atendimento
-- =========================

CREATE POLICY "Company members delete checkins" ON public.checkins
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND company_id = checkins.company_id
    )
  );

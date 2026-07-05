-- =========================
-- Adiciona INSERT policy para user_roles
-- =========================
GRANT INSERT ON public.user_roles TO authenticated;
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =========================
-- Adiciona INSERT policy para companies (usuários autenticados podem criar empresas)
-- =========================
CREATE POLICY "Authenticated users can create companies" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (true);

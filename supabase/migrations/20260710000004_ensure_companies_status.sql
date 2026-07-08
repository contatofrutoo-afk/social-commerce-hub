-- ============================================================
-- WEAZE ADMIN — Garante coluna status em companies e políticas
-- ============================================================

-- 1. Garante que a coluna status existe em companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'bloqueado', 'teste', 'cancelado'));

-- 2. Garante que as colunas de gestão existem
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'Mensal'
    CHECK (plan_type IN ('Mensal', 'Anual', 'Promocional', 'Personalizado')),
  ADD COLUMN IF NOT EXISTS monthly_fee numeric NOT NULL DEFAULT 237,
  ADD COLUMN IF NOT EXISTS next_due_date date,
  ADD COLUMN IF NOT EXISTS last_payment_date date,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'PIX'
    CHECK (payment_method IN ('PIX', 'Cartão', 'Dinheiro', 'Outro')),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('paid', 'pending', 'overdue', 'cancelled')),
  ADD COLUMN IF NOT EXISTS internal_notes text DEFAULT '';

-- 3. Garante que authenticated pode ler as novas colunas
GRANT SELECT (status, plan_type, monthly_fee, next_due_date, last_payment_date, payment_method, payment_status, internal_notes)
  ON public.companies TO authenticated;

-- 4. Garante UPDATE/DELETE policy para admins
DROP POLICY IF EXISTS "Admin gerencia companies" ON public.companies;
CREATE POLICY "Admin gerencia companies" ON public.companies
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  );

DROP POLICY IF EXISTS "Admin deleta companies" ON public.companies;
CREATE POLICY "Admin deleta companies" ON public.companies
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  );

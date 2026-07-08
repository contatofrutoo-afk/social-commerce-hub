-- ============================================================
-- Migra companies para fonte de verdade do Super Admin
-- Adiciona colunas de gestão e migra dados do company_admin
-- ============================================================

-- 1. Adiciona colunas de gestão na tabela companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'bloqueado', 'teste', 'cancelado')),
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

-- 2. Copia dados existentes do company_admin para companies
UPDATE public.companies c
SET
  status = CASE ca.status
    WHEN 'active' THEN 'ativo'
    WHEN 'blocked' THEN 'bloqueado'
    WHEN 'trial' THEN 'teste'
    WHEN 'cancelled' THEN 'cancelado'
    ELSE 'ativo'
  END,
  plan_type = ca.plan_type,
  monthly_fee = ca.monthly_fee,
  next_due_date = ca.next_due_date,
  last_payment_date = ca.last_payment_date,
  payment_method = ca.payment_method,
  payment_status = ca.payment_status,
  internal_notes = ca.internal_notes
FROM public.company_admin ca
WHERE ca.company_id = c.id;

-- 3. Garante que authenticated pode ler o status (necessário para blocker check)
--    (já possui SELECT em companies, mas garantimos por segurança)
GRANT SELECT (status, plan_type, monthly_fee, next_due_date, last_payment_date, payment_method, payment_status, internal_notes)
  ON public.companies TO authenticated;

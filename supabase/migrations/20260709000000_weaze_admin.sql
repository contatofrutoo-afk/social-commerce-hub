-- ============================================================
-- WEAZE ADMIN — Super admin module
-- ============================================================

-- 0. Garante que a função touch_updated_at existe
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 0b. Garante que o valor 'admin' existe no enum app_role
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1. Admin settings
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_plan_value numeric NOT NULL DEFAULT 197,
  blocked_message text DEFAULT 'Seu acesso à plataforma encontra-se temporariamente bloqueado. Para mais informações entre em contato com o administrador da WEAZE.',
  admin_contact text DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.admin_settings (id, default_plan_value, blocked_message, admin_contact)
VALUES ('00000000-0000-0000-0000-000000000000', 237,
  'Seu acesso à plataforma encontra-se temporariamente bloqueado. Para mais informações entre em contato com o administrador da WEAZE.', '')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS blocked_message text DEFAULT 'Seu acesso à plataforma encontra-se temporariamente bloqueado. Para mais informações entre em contato com o administrador da WEAZE.',
  ADD COLUMN IF NOT EXISTS admin_contact text DEFAULT '';

-- 2. Company admin
CREATE TABLE IF NOT EXISTS public.company_admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked','trial','cancelled')),
  plan_type text NOT NULL DEFAULT 'Mensal' CHECK (plan_type IN ('Mensal','Anual','Promocional','Personalizado')),
  monthly_fee numeric NOT NULL DEFAULT 237,
  next_due_date date, last_payment_date date,
  payment_method text NOT NULL DEFAULT 'PIX' CHECK (payment_method IN ('PIX','Cartão','Dinheiro','Outro')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('paid','pending','overdue','cancelled')),
  internal_notes text DEFAULT '', blocked_at timestamptz, blocked_reason text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Company payments
CREATE TABLE IF NOT EXISTS public.company_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL, payment_date date NOT NULL,
  payment_method text NOT NULL DEFAULT 'PIX',
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','pending','overdue','cancelled')),
  notes text DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Company licenses
CREATE TABLE IF NOT EXISTS public.company_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_type text NOT NULL DEFAULT 'Mensal' CHECK (plan_type IN ('Mensal','Anual','Promocional','Personalizado')),
  monthly_fee numeric NOT NULL DEFAULT 237, start_date date NOT NULL, end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  notes text DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. RLS
ALTER TABLE public.company_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin vê company_admin" ON public.company_admin;
CREATE POLICY "Admin vê company_admin" ON public.company_admin
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  );

DROP POLICY IF EXISTS "Admin gerencia company_admin" ON public.company_admin;
CREATE POLICY "Admin gerencia company_admin" ON public.company_admin
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  );

DROP POLICY IF EXISTS "Admin vê company_payments" ON public.company_payments;
CREATE POLICY "Admin vê company_payments" ON public.company_payments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  );

DROP POLICY IF EXISTS "Admin gerencia company_payments" ON public.company_payments;
CREATE POLICY "Admin gerencia company_payments" ON public.company_payments
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  );

DROP POLICY IF EXISTS "Admin vê company_licenses" ON public.company_licenses;
CREATE POLICY "Admin vê company_licenses" ON public.company_licenses
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  );

DROP POLICY IF EXISTS "Admin gerencia company_licenses" ON public.company_licenses;
CREATE POLICY "Admin gerencia company_licenses" ON public.company_licenses
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin')
  );

-- 6. Grants
GRANT ALL ON public.company_admin TO service_role;
GRANT ALL ON public.company_payments TO service_role;
GRANT ALL ON public.company_licenses TO service_role;

-- 7. Trigger
DROP TRIGGER IF EXISTS company_admin_updated ON public.company_admin;
CREATE TRIGGER company_admin_updated
  BEFORE UPDATE ON public.company_admin
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

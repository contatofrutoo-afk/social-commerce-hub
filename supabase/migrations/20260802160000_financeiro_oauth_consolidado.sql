-- ============================================================
-- MÓDULO FINANCEIRO + CONEXÃO OAuth MERCADO PAGO — CONSOLIDADO
--
-- Reúne, em um único script idempotente, a estrutura necessária
-- para o painel Financeiro e para a conexão OAuth do Mercado Pago:
--   payment_accounts, payment_methods, payments, transactions,
--   payment_logs, payment_oauth_states, merchant_payment_accounts,
--   platform_settings.
--
-- Seguro rodar mais de uma vez: CREATE TABLE/INDEX IF NOT EXISTS,
-- ADD COLUMN IF NOT EXISTS, REVOKE/GRANT idempotentes, DROP POLICY
-- IF EXISTS antes de cada CREATE POLICY.
-- ============================================================

-- ------------------------------------------------------------
-- payment_accounts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'connected', 'error')),
  account_name text,
  account_id text,
  credentials jsonb,
  last_sync_at timestamptz,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, provider)
);

ALTER TABLE public.payment_accounts
  ADD COLUMN IF NOT EXISTS provider_user_id text,
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS payment_accounts_business_id_idx
  ON public.payment_accounts (business_id);

ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read payment_accounts" ON public.payment_accounts;
CREATE POLICY "Members read payment_accounts"
  ON public.payment_accounts FOR SELECT TO authenticated
  USING (private.has_company_access(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members insert payment_accounts" ON public.payment_accounts;
CREATE POLICY "Members insert payment_accounts"
  ON public.payment_accounts FOR INSERT TO authenticated
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members update payment_accounts" ON public.payment_accounts;
CREATE POLICY "Members update payment_accounts"
  ON public.payment_accounts FOR UPDATE TO authenticated
  USING (private.has_company_access(auth.uid(), business_id))
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members delete payment_accounts" ON public.payment_accounts;
CREATE POLICY "Members delete payment_accounts"
  ON public.payment_accounts FOR DELETE TO authenticated
  USING (private.has_company_access(auth.uid(), business_id));

REVOKE ALL ON public.payment_accounts FROM anon;
REVOKE ALL ON public.payment_accounts FROM authenticated;
GRANT SELECT (
  id,
  business_id,
  provider,
  status,
  account_name,
  account_id,
  provider_user_id,
  last_sync_at,
  connected_at,
  created_at,
  updated_at,
  expires_at
) ON public.payment_accounts TO authenticated;
GRANT ALL ON public.payment_accounts TO service_role;

-- ------------------------------------------------------------
-- payment_methods
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  method text NOT NULL
    CHECK (method IN ('pix', 'card', 'cash', 'counter')),
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  available_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, method)
);

CREATE INDEX IF NOT EXISTS payment_methods_business_id_idx
  ON public.payment_methods (business_id);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read payment_methods" ON public.payment_methods;
CREATE POLICY "Members read payment_methods"
  ON public.payment_methods FOR SELECT TO authenticated
  USING (private.has_company_access(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members insert payment_methods" ON public.payment_methods;
CREATE POLICY "Members insert payment_methods"
  ON public.payment_methods FOR INSERT TO authenticated
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members update payment_methods" ON public.payment_methods;
CREATE POLICY "Members update payment_methods"
  ON public.payment_methods FOR UPDATE TO authenticated
  USING (private.has_company_access(auth.uid(), business_id))
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members delete payment_methods" ON public.payment_methods;
CREATE POLICY "Members delete payment_methods"
  ON public.payment_methods FOR DELETE TO authenticated
  USING (private.has_company_access(auth.uid(), business_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;

-- ------------------------------------------------------------
-- payments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  method text NOT NULL
    CHECK (method IN ('pix', 'card', 'cash', 'counter')),
  amount numeric(10, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  gateway text,
  gateway_transaction_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_business_id_idx
  ON public.payments (business_id);

CREATE INDEX IF NOT EXISTS payments_order_id_idx
  ON public.payments (order_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read payments" ON public.payments;
CREATE POLICY "Members read payments"
  ON public.payments FOR SELECT TO authenticated
  USING (private.has_company_access(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members insert payments" ON public.payments;
CREATE POLICY "Members insert payments"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members update payments" ON public.payments;
CREATE POLICY "Members update payments"
  ON public.payments FOR UPDATE TO authenticated
  USING (private.has_company_access(auth.uid(), business_id))
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members delete payments" ON public.payments;
CREATE POLICY "Members delete payments"
  ON public.payments FOR DELETE TO authenticated
  USING (private.has_company_access(auth.uid(), business_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

-- ------------------------------------------------------------
-- transactions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  type text NOT NULL
    CHECK (type IN ('sale', 'refund', 'fee', 'payout')),
  method text
    CHECK (method IN ('pix', 'card', 'cash', 'counter')),
  amount numeric(10, 2) NOT NULL DEFAULT 0,
  balance_after numeric(10, 2),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_business_id_idx
  ON public.transactions (business_id);

CREATE INDEX IF NOT EXISTS transactions_payment_id_idx
  ON public.transactions (payment_id);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read transactions" ON public.transactions;
CREATE POLICY "Members read transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (private.has_company_access(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members insert transactions" ON public.transactions;
CREATE POLICY "Members insert transactions"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members update transactions" ON public.transactions;
CREATE POLICY "Members update transactions"
  ON public.transactions FOR UPDATE TO authenticated
  USING (private.has_company_access(auth.uid(), business_id))
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members delete transactions" ON public.transactions;
CREATE POLICY "Members delete transactions"
  ON public.transactions FOR DELETE TO authenticated
  USING (private.has_company_access(auth.uid(), business_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

-- ------------------------------------------------------------
-- payment_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  event text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_logs_business_id_idx
  ON public.payment_logs (business_id);

CREATE INDEX IF NOT EXISTS payment_logs_payment_id_idx
  ON public.payment_logs (payment_id);

ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read payment_logs" ON public.payment_logs;
CREATE POLICY "Members read payment_logs"
  ON public.payment_logs FOR SELECT TO authenticated
  USING (private.has_company_access(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members insert payment_logs" ON public.payment_logs;
CREATE POLICY "Members insert payment_logs"
  ON public.payment_logs FOR INSERT TO authenticated
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members update payment_logs" ON public.payment_logs;
CREATE POLICY "Members update payment_logs"
  ON public.payment_logs FOR UPDATE TO authenticated
  USING (private.has_company_access(auth.uid(), business_id))
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

DROP POLICY IF EXISTS "Members delete payment_logs" ON public.payment_logs;
CREATE POLICY "Members delete payment_logs"
  ON public.payment_logs FOR DELETE TO authenticated
  USING (private.has_company_access(auth.uid(), business_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_logs TO authenticated;
GRANT ALL ON public.payment_logs TO service_role;

-- ------------------------------------------------------------
-- payment_oauth_states (fluxo OAuth, só backend)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  state text NOT NULL UNIQUE,
  redirect_uri text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_oauth_states
  ADD COLUMN IF NOT EXISTS code_verifier text,
  ADD COLUMN IF NOT EXISTS code_challenge text;

CREATE INDEX IF NOT EXISTS payment_oauth_states_business_id_idx
  ON public.payment_oauth_states (business_id);

CREATE INDEX IF NOT EXISTS payment_oauth_states_state_idx
  ON public.payment_oauth_states (state);

ALTER TABLE public.payment_oauth_states ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.payment_oauth_states FROM anon, authenticated;
GRANT ALL ON public.payment_oauth_states TO service_role;

-- ------------------------------------------------------------
-- merchant_payment_accounts (conta do comerciante, só backend)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merchant_payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mercadopago',
  provider_user_id text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  connected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, provider)
);

CREATE INDEX IF NOT EXISTS merchant_payment_accounts_merchant_idx
  ON public.merchant_payment_accounts (merchant_id);

ALTER TABLE public.merchant_payment_accounts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.merchant_payment_accounts FROM anon, authenticated;
GRANT ALL ON public.merchant_payment_accounts TO service_role;

CREATE OR REPLACE FUNCTION private.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS merchant_payment_accounts_set_updated_at
  ON public.merchant_payment_accounts;
CREATE TRIGGER merchant_payment_accounts_set_updated_at
  BEFORE UPDATE ON public.merchant_payment_accounts
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

-- ------------------------------------------------------------
-- platform_settings (credenciais globais, painel admin)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mercadopago_client_id text,
  mercadopago_client_secret text,
  mercadopago_public_key text,
  mercadopago_access_token text,
  mercadopago_webhook_secret text,
  mercadopago_redirect_uri text,
  mercadopago_encryption_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.platform_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

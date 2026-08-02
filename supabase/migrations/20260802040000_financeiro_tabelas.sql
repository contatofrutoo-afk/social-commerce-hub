-- ============================================================
-- MÓDULO FINANCEIRO — arquitetura inicial
--
-- Apenas estrutura (CREATE TABLE + RLS). Sem regras de negócio,
-- sem integração com gateways de pagamento e sem processamento
-- de pagamentos nesta etapa.
--
-- Tabelas:
--   payment_accounts  -> conta/vínculo de um provedor de pagamento
--                        (ex.: Mercado Pago) por empresa.
--   payment_methods   -> catálogo de formas de pagamento por empresa
--                        (pix, cartão, dinheiro, caixa).
--   payments          -> pagamentos de pedidos.
--   transactions      -> lançamentos financeiros (histórico).
--   payment_logs      -> auditoria de eventos do módulo.
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

CREATE INDEX IF NOT EXISTS payment_accounts_business_id_idx
  ON public.payment_accounts (business_id);

ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read payment_accounts"
  ON public.payment_accounts FOR SELECT TO authenticated
  USING (private.has_company_access(auth.uid(), business_id));

CREATE POLICY "Members insert payment_accounts"
  ON public.payment_accounts FOR INSERT TO authenticated
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

CREATE POLICY "Members update payment_accounts"
  ON public.payment_accounts FOR UPDATE TO authenticated
  USING (private.has_company_access(auth.uid(), business_id))
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

CREATE POLICY "Members delete payment_accounts"
  ON public.payment_accounts FOR DELETE TO authenticated
  USING (private.has_company_access(auth.uid(), business_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_accounts TO authenticated;
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

CREATE POLICY "Members read payment_methods"
  ON public.payment_methods FOR SELECT TO authenticated
  USING (private.has_company_access(auth.uid(), business_id));

CREATE POLICY "Members insert payment_methods"
  ON public.payment_methods FOR INSERT TO authenticated
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

CREATE POLICY "Members update payment_methods"
  ON public.payment_methods FOR UPDATE TO authenticated
  USING (private.has_company_access(auth.uid(), business_id))
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

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

CREATE POLICY "Members read payments"
  ON public.payments FOR SELECT TO authenticated
  USING (private.has_company_access(auth.uid(), business_id));

CREATE POLICY "Members insert payments"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

CREATE POLICY "Members update payments"
  ON public.payments FOR UPDATE TO authenticated
  USING (private.has_company_access(auth.uid(), business_id))
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

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

CREATE POLICY "Members read transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (private.has_company_access(auth.uid(), business_id));

CREATE POLICY "Members insert transactions"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

CREATE POLICY "Members update transactions"
  ON public.transactions FOR UPDATE TO authenticated
  USING (private.has_company_access(auth.uid(), business_id))
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

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

CREATE POLICY "Members read payment_logs"
  ON public.payment_logs FOR SELECT TO authenticated
  USING (private.has_company_access(auth.uid(), business_id));

CREATE POLICY "Members insert payment_logs"
  ON public.payment_logs FOR INSERT TO authenticated
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

CREATE POLICY "Members update payment_logs"
  ON public.payment_logs FOR UPDATE TO authenticated
  USING (private.has_company_access(auth.uid(), business_id))
  WITH CHECK (private.has_company_access(auth.uid(), business_id));

CREATE POLICY "Members delete payment_logs"
  ON public.payment_logs FOR DELETE TO authenticated
  USING (private.has_company_access(auth.uid(), business_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_logs TO authenticated;
GRANT ALL ON public.payment_logs TO service_role;

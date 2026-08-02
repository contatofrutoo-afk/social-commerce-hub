-- ============================================================
-- ETAPA 4 — PEDIDOS COM PAGAMENTO ONLINE
--
-- 1. Novos status do fluxo de pagamento online:
--      awaiting_payment  -> Aguardando pagamento
--      payment_approved  -> Pagamento aprovado
--      delivered         -> Entregue
--    Os status antigos (received, payment_at_counter, preparing,
--    ready, completed, cancelled) são mantidos para pedidos legados.
--
-- 2. orders ganha as colunas da Etapa 4:
--      merchant_id          -> dono do pedido (alias de company_id)
--      customer_session_id  -> sessão anônima do cliente (sem PII)
--      payment_status       -> pending | paid | failed | cancelled | refunded
--      payment_provider     -> mercadopago | counter
--      payment_id           -> id do pagamento no gateway
--      subtotal / discount / total
--      updated_at
--
-- 3. order_items.total (coluna gerada: quantity * unit_price).
--
-- Seguro reexecutar.
-- ============================================================

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'awaiting_payment';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'payment_approved';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'delivered';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS customer_session_id text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  ADD COLUMN IF NOT EXISTS payment_provider text
    CHECK (payment_provider IS NULL OR payment_provider IN ('mercadopago', 'counter')),
  ADD COLUMN IF NOT EXISTS payment_id text,
  ADD COLUMN IF NOT EXISTS payment_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS subtotal numeric(10, 2),
  ADD COLUMN IF NOT EXISTS discount numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- updated_at automático para orders
CREATE OR REPLACE FUNCTION public.touch_order_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_set_updated_at ON public.orders;
CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_order_updated_at();

CREATE INDEX IF NOT EXISTS orders_merchant_created_idx
  ON public.orders (merchant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_payment_id_idx
  ON public.orders (payment_id);

-- order_items.total: coluna gerada (quantidade x unit_price)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS total numeric(10, 2)
    GENERATED ALWAYS AS (quantity * unit_price) STORED;

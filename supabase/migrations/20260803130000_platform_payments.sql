-- ============================================================
-- FINANCEIRO DA PLATAFORMA — tabela consolidada de pagamentos
--
-- Consolida, para o painel admin (exclusivo), todo o volume
-- financeiro gerado na WEAZE:
--
--   - origem mercado_pago: pagamentos online confirmados pelo
--     webhook do Mercado Pago. Idempotência por
--     mercadopago_payment_id (payment_id do gateway).
--
--   - origem cashier: pagamentos presenciais registrados quando o
--     comerciante finaliza o pedido (finalize_order / complete_order).
--     Idempotência por order_id.
--
-- Apenas admins leem esta tabela (RLS SELECT via has_role). As
-- gravações ocorrem via service_role (webhook) e RPCs SECURITY
-- DEFINER (finalize_order / complete_order), que ignoram RLS.
--
-- Seguro reexecutar.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_name text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_origin text NOT NULL
    CHECK (payment_origin IN ('mercado_pago', 'cashier')),
  payment_method text NOT NULL
    CHECK (payment_method IN ('pix', 'credit_card', 'debit_card', 'cash', 'other')),
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('approved', 'cancelled', 'refunded', 'pending')),
  gross_amount numeric(12, 2) NOT NULL DEFAULT 0,
  net_amount numeric(12, 2) NOT NULL DEFAULT 0,
  mercadopago_payment_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Dedupe online: um payment do Mercado Pago gera uma única linha.
-- O índice aceita múltiplos NULL (linhas de origem cashier).
CREATE UNIQUE INDEX IF NOT EXISTS platform_payments_mp_payment_id_uidx
  ON public.platform_payments (mercadopago_payment_id);

-- Dedupe caixa: um pedido gera uma única linha na origem cashier.
CREATE UNIQUE INDEX IF NOT EXISTS platform_payments_cashier_order_uidx
  ON public.platform_payments (order_id)
  WHERE payment_origin = 'cashier';

CREATE INDEX IF NOT EXISTS platform_payments_company_paid_idx
  ON public.platform_payments (company_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS platform_payments_paid_at_idx
  ON public.platform_payments (paid_at);

CREATE INDEX IF NOT EXISTS platform_payments_origin_idx
  ON public.platform_payments (payment_origin);

ALTER TABLE public.platform_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read platform_payments" ON public.platform_payments;
CREATE POLICY "Admins read platform_payments"
  ON public.platform_payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT ON public.platform_payments TO authenticated;
GRANT ALL ON public.platform_payments TO service_role;

-- ============================================================
-- finalize_order: registra o pagamento "No Caixa" quando o
-- comerciante finaliza o pedido sem mesa (loja/QR/link geral).
-- ============================================================

CREATE OR REPLACE FUNCTION private.finalize_order(_order_id uuid, _caller uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order record;
  v_item record;
BEGIN
  SELECT id, company_id, customer_id, status, payment_status,
         payment_method, payment_provider, total
    INTO v_order
    FROM public.orders
   WHERE id = _order_id;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  IF _caller IS NULL OR NOT private.has_company_access(_caller, v_order.company_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_order.status = 'completed' THEN
    RETURN;
  END IF;

  UPDATE public.orders
     SET status = 'completed',
         payment_status = CASE
           WHEN payment_status = 'pending' THEN 'paid'
           ELSE payment_status
         END,
         payment_approved_at = CASE
           WHEN payment_status = 'pending' THEN COALESCE(payment_approved_at, now())
           ELSE payment_approved_at
         END
   WHERE id = _order_id;

  -- Registro no Financeiro da Plataforma (pagamento no caixa).
  INSERT INTO public.platform_payments
    (company_id, company_name, order_id, payment_origin, payment_method,
     payment_status, gross_amount, net_amount, paid_at)
  SELECT v_order.company_id, c.name, v_order.id, 'cashier',
         CASE v_order.payment_method
           WHEN 'pix' THEN 'pix'
           WHEN 'card' THEN 'credit_card'
           ELSE 'cash'
         END,
         'approved', v_order.total, v_order.total, now()
    FROM public.companies c
   WHERE c.id = v_order.company_id
     AND (v_order.payment_provider IS NULL OR v_order.payment_provider <> 'mercadopago')
  ON CONFLICT (order_id) WHERE payment_origin = 'cashier'
  DO UPDATE SET updated_at = now();

  FOR v_item IN
    SELECT oi.product_id, oi.quantity, oi.unit_price
      FROM public.order_items oi
     WHERE oi.order_id = _order_id
  LOOP
    INSERT INTO public.product_events (product_id, company_id, customer_id, event_type, metadata)
    VALUES (v_item.product_id, v_order.company_id, v_order.customer_id, 'purchase',
      jsonb_build_object('order_id', v_order.id, 'quantity', v_item.quantity, 'unit_price', v_item.unit_price));
    UPDATE public.products
       SET order_count = order_count + 1,
           revenue = revenue + (v_item.quantity * v_item.unit_price)
     WHERE id = v_item.product_id;
    IF NOT EXISTS (
      SELECT 1 FROM public.product_events
       WHERE product_id = v_item.product_id
         AND customer_id = v_order.customer_id
         AND event_type = 'purchase'
         AND metadata->>'order_id' <> _order_id::text
    ) THEN
      UPDATE public.products SET unique_customers = unique_customers + 1
       WHERE id = v_item.product_id;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_order(_order_id uuid)
RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ SELECT private.finalize_order(_order_id, auth.uid()); $$;

REVOKE ALL ON FUNCTION public.finalize_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_order(uuid) TO authenticated;

-- ============================================================
-- complete_order: registra o pagamento "No Caixa" quando um
-- pedido de mesa é concluído pelo fluxo de avanço de status.
-- ============================================================

CREATE OR REPLACE FUNCTION private.complete_order(_order_id uuid, _caller uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_order record; v_item record;
BEGIN
  SELECT id, company_id, customer_id, status, payment_method, payment_provider, total
    INTO v_order FROM public.orders WHERE id = _order_id;
  IF v_order IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF _caller IS NULL OR NOT private.has_company_access(_caller, v_order.company_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_order.status = 'completed' THEN RETURN; END IF;
  UPDATE public.orders SET status = 'completed' WHERE id = _order_id;

  -- Registro no Financeiro da Plataforma (pagamento no caixa).
  INSERT INTO public.platform_payments
    (company_id, company_name, order_id, payment_origin, payment_method,
     payment_status, gross_amount, net_amount, paid_at)
  SELECT v_order.company_id, c.name, v_order.id, 'cashier',
         CASE v_order.payment_method
           WHEN 'pix' THEN 'pix'
           WHEN 'card' THEN 'credit_card'
           ELSE 'cash'
         END,
         'approved', v_order.total, v_order.total, now()
    FROM public.companies c
   WHERE c.id = v_order.company_id
     AND (v_order.payment_provider IS NULL OR v_order.payment_provider <> 'mercadopago')
  ON CONFLICT (order_id) WHERE payment_origin = 'cashier'
  DO UPDATE SET updated_at = now();

  FOR v_item IN SELECT oi.product_id, oi.quantity, oi.unit_price FROM public.order_items oi WHERE oi.order_id = _order_id LOOP
    INSERT INTO public.product_events (product_id, company_id, customer_id, event_type, metadata)
    VALUES (v_item.product_id, v_order.company_id, v_order.customer_id, 'purchase',
      jsonb_build_object('order_id', v_order.id, 'quantity', v_item.quantity, 'unit_price', v_item.unit_price));
    UPDATE public.products SET order_count = order_count + 1,
      revenue = revenue + (v_item.quantity * v_item.unit_price) WHERE id = v_item.product_id;
    IF NOT EXISTS (SELECT 1 FROM public.product_events
      WHERE product_id = v_item.product_id AND customer_id = v_order.customer_id
        AND event_type = 'purchase' AND metadata->>'order_id' <> _order_id::text) THEN
      UPDATE public.products SET unique_customers = unique_customers + 1 WHERE id = v_item.product_id;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_order(_order_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ SELECT private.complete_order(_order_id, auth.uid()); $$;

REVOKE ALL ON FUNCTION public.complete_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_order(uuid) TO authenticated;

-- ============================================================
-- FINANCEIRO DA PLATAFORMA — apenas pagamentos concluídos
--
-- Correção do painel para mostrar SOMENTE pagamentos de fato
-- concluídos, nunca pagamentos apenas "gerados".
--
-- Causa raiz: o RPC admin_list_platform_payments lia direto de
-- `orders` e contava todo pedido com payment_status='paid' como
-- venda concluída, usando o payment_provider (definido na mera
-- geração da preferência do MP) para rotular a origem. Assim um
-- pedido que só GEROU pagamento no MP e foi finalizado no balcão
-- (finalize_order marca payment_status='paid' e status='completed')
-- aparecia como "Mercado Pago" concluído.
--
-- Correções:
--   1. admin_list_platform_payments passa a ler platform_payments
--      (tabela consolidada, gravada apenas por fluxos verificados:
--      webhook/checkout quando o MP aprova, e finalização no caixa).
--   2. finalize_order / complete_order agora registram "No Caixa"
--      mesmo para pedidos com payment_provider='mercadopago' que
--      NÃO foram aprovados no gateway (status <> 'payment_approved').
--      Pedidos realmente aprovados no MP continuam sem linha de caixa.
--   3. Correção idempotente dos dados já existentes: remove falsos
--      "mercado_pago" não aprovados, registra os finalizados no
--      balcão como cashier e re-registra apenas MP com aprovação real.
--
-- Seguro reexecutar.
-- ============================================================

-- 1) PAINEL LÊ A TABELA CONSOLIDADA (somente pagamentos concluídos)
CREATE OR REPLACE FUNCTION public.admin_list_platform_payments()
RETURNS TABLE (
  id uuid,
  company_id uuid,
  company_name text,
  order_id uuid,
  payment_origin text,
  payment_method text,
  payment_status text,
  gross_amount numeric,
  net_amount numeric,
  mercadopago_payment_id text,
  paid_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem consultar o financeiro da plataforma';
  END IF;

  RETURN QUERY
  SELECT
    pp.id,
    pp.company_id,
    pp.company_name,
    pp.order_id,
    pp.payment_origin,
    pp.payment_method,
    pp.payment_status,
    pp.gross_amount,
    pp.net_amount,
    pp.mercadopago_payment_id,
    pp.paid_at,
    pp.created_at
  FROM public.platform_payments pp
  WHERE pp.payment_status = 'approved'
  ORDER BY pp.paid_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_platform_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_platform_payments() TO authenticated;

-- 2) finalize_order: pedido sem mesa finalizado no caixa.
--    Registra "No Caixa" também para pedidos com provider mercadopago
--    que não foram aprovados no gateway (status <> 'payment_approved').
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
  -- Só NÃO registra quando o pedido foi realmente aprovado no MP
  -- (status='payment_approved' — marcado apenas pelo webhook/checkout).
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
     AND NOT (v_order.payment_provider = 'mercadopago' AND v_order.status = 'payment_approved')
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

-- 3) complete_order: pedido de mesa concluído pelo fluxo de status.
--    Mesma regra de origem do finalize_order.
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
     AND NOT (v_order.payment_provider = 'mercadopago' AND v_order.status = 'payment_approved')
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

-- 4) CORREÇÃO DOS DADOS JÁ EXISTENTES (idempotente)

-- 4.1 Remove falsos "mercado_pago" (registrados por backfill) cujo pedido
--     NÃO foi aprovado no gateway (status <> 'payment_approved').
DELETE FROM public.platform_payments pp
USING public.orders o
WHERE pp.order_id = o.id
  AND pp.payment_origin = 'mercado_pago'
  AND o.status <> 'payment_approved';

-- 4.2 Re-registra como "No Caixa" os pedidos finalizados no balcão que
--     tinham provider mercadopago mas nunca foram aprovados no MP.
INSERT INTO public.platform_payments
  (company_id, company_name, order_id, payment_origin, payment_method,
   payment_status, gross_amount, net_amount, paid_at)
SELECT o.company_id, c.name, o.id, 'cashier',
       CASE o.payment_method
         WHEN 'pix' THEN 'pix'
         WHEN 'card' THEN 'credit_card'
         ELSE 'cash'
       END,
       'approved', o.total, o.total,
       COALESCE(o.payment_approved_at, o.updated_at)
  FROM public.orders o
  JOIN public.companies c ON c.id = o.company_id
  WHERE o.payment_status = 'paid'
    AND o.payment_provider = 'mercadopago'
    AND o.status = 'completed'
    AND NOT EXISTS (
      SELECT 1 FROM public.platform_payments pp
       WHERE pp.order_id = o.id AND pp.payment_origin = 'mercado_pago'
    )
ON CONFLICT (order_id) WHERE payment_origin = 'cashier' DO NOTHING;

-- 4.3 Re-registra "Mercado Pago" APENAS pedidos com aprovação real
--     (status='payment_approved' — marcado pelo webhook/checkout).
INSERT INTO public.platform_payments
  (company_id, company_name, order_id, payment_origin, payment_method,
   payment_status, gross_amount, net_amount, mercadopago_payment_id, paid_at)
SELECT o.company_id, c.name, o.id, 'mercado_pago',
       CASE o.payment_method
         WHEN 'pix' THEN 'pix'
         WHEN 'card' THEN 'credit_card'
         ELSE 'other'
       END,
       'approved', o.total, o.total, o.payment_id,
       COALESCE(o.payment_approved_at, o.updated_at)
  FROM public.orders o
  JOIN public.companies c ON c.id = o.company_id
 WHERE o.payment_status = 'paid'
   AND o.payment_provider = 'mercadopago'
   AND o.status = 'payment_approved'
   AND o.payment_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4.4 Backfill "No Caixa" dos demais pedidos concluídos sem gateway.
INSERT INTO public.platform_payments
  (company_id, company_name, order_id, payment_origin, payment_method,
   payment_status, gross_amount, net_amount, paid_at)
SELECT o.company_id, c.name, o.id, 'cashier',
       CASE o.payment_method
         WHEN 'pix' THEN 'pix'
         WHEN 'card' THEN 'credit_card'
         ELSE 'cash'
       END,
       'approved', o.total, o.total,
       COALESCE(o.payment_approved_at, o.updated_at)
  FROM public.orders o
  JOIN public.companies c ON c.id = o.company_id
 WHERE o.status = 'completed'
   AND (o.payment_provider IS NULL OR o.payment_provider = 'counter')
ON CONFLICT (order_id) WHERE payment_origin = 'cashier' DO NOTHING;

-- CONFERÊNCIA — rode e veja o que o painel vai exibir:
--   SELECT payment_origin, payment_method, payment_status, count(*) AS pedidos,
--          sum(gross_amount) AS total
--     FROM public.platform_payments
--    GROUP BY 1, 2, 3
--    ORDER BY 2;

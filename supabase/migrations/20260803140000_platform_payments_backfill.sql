-- ============================================================
-- BACKFILL — Financeiro da Plataforma
--
-- Popula platform_payments com vendas que já foram pagas antes
-- da tabela existir, para que o painel admin não comece vazio.
--
--   - Mercado Pago: pedidos payment_status='paid' com gateway
--     mercadopago e payment_id preenchido. Sem os dados da API,
--     gross = net = total do pedido (aproximação sem taxas).
--   - No Caixa: pedidos status='completed' sem gateway.
--
-- Idempotente (ON CONFLICT DO NOTHING): os registros criados
-- daqui em diante pelo webhook / finalize / complete são
-- mantidos intactos.
--
-- Seguro reexecutar.
-- ============================================================

-- Pagamentos online (Mercado Pago) já aprovados
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
   AND o.payment_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Pagamentos no caixa (pedidos concluídos sem gateway)
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
ON CONFLICT DO NOTHING;

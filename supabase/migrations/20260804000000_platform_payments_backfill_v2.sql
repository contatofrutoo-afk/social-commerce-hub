-- ============================================================
-- BACKFILL v2 — Financeiro da Plataforma (vendas online reais)
--
-- O painel admin só mostra o que existe em platform_payments. Antes
-- desta correção, uma venda aprovada pelo checkout (Pix/Cartão)
-- muitas vezes nunca era gravada lá: o webhook do Mercado Pago
-- chegava depois do pedido já estar marcado como pago e retornava
-- "already_processed" sem inserir a linha.
--
-- Este backfill garante que TODAS as vendas reais do Mercado Pago
-- (pedidos payment_status='paid' + payment_provider='mercadopago' +
-- payment_id preenchido) tenham sua linha correspondente, mesmo que
-- tenham sido concluídas antes da correção.
--
-- Idempotente (ON CONFLICT DO NOTHING): não sobrescreve registros
-- já criados pelo webhook (que têm net_received_amount real).
--
-- Seguro reexecutar.
-- ============================================================

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

-- Fase 3 — Checkout Inteligente (sem gateway de pagamento)
-- 1. Estende o enum order_status com os novos status do fluxo de pedidos.
--    'received' e 'completed' são mantidos para compatibilidade com pedidos antigos.
-- 2. Adiciona orders.payment_method (texto) para registrar a forma de pagamento
--    escolhida no checkout. 'counter' (Pagamento no Caixa) é o único funcional
--    nesta fase; 'pix' e 'card' ficam reservados para a Fase 4+.

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'payment_at_counter';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'preparing';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'ready';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('pix', 'card', 'counter'));

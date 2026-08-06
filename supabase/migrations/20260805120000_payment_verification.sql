-- ============================================================
-- CENTRAL DE PAGAMENTOS EM TEMPO REAL — CONFERÊNCIA OPERACIONAL
--
-- 1. Colunas de conferência em orders (sem nova tabela):
--      payment_verification_status -> 'awaiting' | 'verified' (NULL = legado/não se aplica)
--      payment_verified_at         -> quando foi conferido
--      payment_verified_by         -> usuário responsável
-- 2. Índice parcial para consultas leves por estabelecimento.
-- 3. Trigger: define 'awaiting' automaticamente quando um pagamento
--    Mercado Pago é aprovado — cobre também pagamentos aprovados pelo
--    checkout antes do webhook. Gate: apenas MP + paid.
--    Pagamentos pagos ANTES deste deploy ficam com NULL e não aparecem
--    na Central (já foram atendidos pelo fluxo anterior).
--
-- Seguro reexecutar.
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_verification_status text
    CHECK (payment_verification_status IN ('awaiting', 'verified')),
  ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_payment_verification_idx
  ON public.orders (company_id, created_at DESC)
  WHERE payment_verification_status IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mark_payment_awaiting_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'paid'
     AND NEW.payment_provider = 'mercadopago'
     AND NEW.payment_verification_status IS NULL THEN
    NEW.payment_verification_status := 'awaiting';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_payment_verification ON public.orders;
CREATE TRIGGER orders_payment_verification
  BEFORE INSERT OR UPDATE OF payment_status, payment_provider ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_payment_awaiting_verification();

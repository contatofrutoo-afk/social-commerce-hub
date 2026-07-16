-- ============================================================
-- Corrige admin_set_company_status para calcular next_due_date
-- e atualiza dados existentes onde falta o vencimento
-- ============================================================

-- 1. Corrige a função admin_set_company_status
CREATE OR REPLACE FUNCTION public.admin_set_company_status(
  _company_id uuid,
  _new_status text,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'admin') INTO _is_admin;
  IF NOT _is_admin THEN RAISE EXCEPTION 'Forbidden'; END IF;

  IF _new_status NOT IN ('ativo','bloqueado','teste','cancelado','aguardando_pagamento','pagamento_em_analise') THEN
    RAISE EXCEPTION 'Status inválido: %', _new_status;
  END IF;

  UPDATE public.companies
    SET status = _new_status,
        approved_by = CASE WHEN _new_status = 'ativo' THEN _uid ELSE approved_by END,
        approved_at = CASE WHEN _new_status = 'ativo' THEN now() ELSE approved_at END,
        payment_confirmation_date = CASE WHEN _new_status = 'ativo' THEN now() ELSE payment_confirmation_date END,
        payment_status = CASE WHEN _new_status = 'ativo' THEN 'paid'
                              WHEN _new_status = 'cancelado' THEN 'cancelled'
                              ELSE payment_status END,
        last_payment_date = CASE WHEN _new_status = 'ativo' THEN now()::date ELSE last_payment_date END,
        next_due_date = CASE WHEN _new_status = 'ativo' THEN (now()::date + interval '1 month')::date ELSE next_due_date END,
        blocked_at = CASE WHEN _new_status = 'bloqueado' THEN now() ELSE blocked_at END,
        blocked_reason = CASE WHEN _new_status = 'bloqueado' THEN _reason ELSE blocked_reason END
  WHERE id = _company_id;
END;
$$;

-- 2. Corrige empresas existentes que têm last_payment_date mas sem next_due_date
UPDATE public.companies
SET next_due_date = (last_payment_date + interval '1 month')::date
WHERE last_payment_date IS NOT NULL
  AND next_due_date IS NULL;

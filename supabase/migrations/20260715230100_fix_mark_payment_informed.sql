-- ============================================================
-- Corrige mark_payment_informed: 'manager' → 'admin'
-- Adiciona cálculo automático de last_payment_date e next_due_date
-- ============================================================

-- Versão sem parâmetro
DROP FUNCTION IF EXISTS public.mark_payment_informed();
CREATE OR REPLACE FUNCTION public.mark_payment_informed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _company_id uuid;
  _current_status text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT company_id INTO _company_id
  FROM public.user_roles
  WHERE user_id = _uid AND role IN ('owner', 'admin')
  LIMIT 1;

  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Sem empresa vinculada';
  END IF;

  SELECT status INTO _current_status
  FROM public.companies
  WHERE id = _company_id;

  IF _current_status NOT IN ('aguardando_pagamento', 'cancelado', 'bloqueado') THEN
    RAISE EXCEPTION 'Status atual (%) não permite informar pagamento', _current_status;
  END IF;

  UPDATE public.companies
  SET status = 'pagamento_em_analise',
      payment_informed_at = now(),
      payment_status = 'pending',
      last_payment_date = CURRENT_DATE,
      next_due_date = (CURRENT_DATE + interval '1 month')::date
  WHERE id = _company_id;
END;
$$;

-- Versão com _method (usada pelo card de confirmação de pagamento)
DROP FUNCTION IF EXISTS public.mark_payment_informed(text);
CREATE OR REPLACE FUNCTION public.mark_payment_informed(_method text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _company_id uuid;
  _current_status text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT company_id INTO _company_id
  FROM public.user_roles
  WHERE user_id = _uid AND role IN ('owner', 'admin')
  LIMIT 1;

  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Sem empresa vinculada';
  END IF;

  SELECT status INTO _current_status
  FROM public.companies
  WHERE id = _company_id;

  IF _current_status NOT IN ('aguardando_pagamento', 'cancelado', 'bloqueado') THEN
    RAISE EXCEPTION 'Status atual (%) não permite informar pagamento', _current_status;
  END IF;

  UPDATE public.companies
  SET status = 'pagamento_em_analise',
      payment_informed_at = now(),
      payment_status = 'pending',
      payment_method = COALESCE(_method, payment_method),
      last_payment_date = CURRENT_DATE,
      next_due_date = (CURRENT_DATE + interval '1 month')::date
  WHERE id = _company_id
    AND (_method IS NULL OR _method IN ('PIX', 'Cartão', 'Dinheiro', 'Outro'));

  IF NOT FOUND THEN
    UPDATE public.companies
    SET status = 'pagamento_em_analise',
        payment_informed_at = now(),
        payment_status = 'pending',
        last_payment_date = CURRENT_DATE,
        next_due_date = (CURRENT_DATE + interval '1 month')::date
    WHERE id = _company_id;
  END IF;
END;
$$;

-- Função para deletar empresa (cascata para user_roles, company_admin, etc.)
CREATE OR REPLACE FUNCTION public.delete_company(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_roles WHERE company_id = _company_id;
  DELETE FROM public.company_admin WHERE company_id = _company_id;
  DELETE FROM public.company_payments WHERE company_id = _company_id;
  DELETE FROM public.company_licenses WHERE company_id = _company_id;
  DELETE FROM public.companies WHERE id = _company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_company(uuid) TO authenticated;

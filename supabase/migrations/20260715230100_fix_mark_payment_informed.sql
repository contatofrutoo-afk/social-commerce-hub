-- ============================================================
-- Corrige mark_payment_informed: 'manager' → 'admin'
-- (valor inválido no enum app_role causava erro ao clicar "Já realizei o pagamento")
-- Existem duas sobrecargas: uma sem parâmetro e uma com _method
-- ============================================================

-- Versão sem parâmetro
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
      payment_status = 'pending'
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
      payment_method = COALESCE(_method, payment_method)
  WHERE id = _company_id
    AND (_method IS NULL OR _method IN ('PIX', 'Cartão', 'Dinheiro', 'Outro'));

  IF NOT FOUND THEN
    UPDATE public.companies
    SET status = 'pagamento_em_analise',
        payment_informed_at = now(),
        payment_status = 'pending'
    WHERE id = _company_id;
  END IF;
END;
$$;

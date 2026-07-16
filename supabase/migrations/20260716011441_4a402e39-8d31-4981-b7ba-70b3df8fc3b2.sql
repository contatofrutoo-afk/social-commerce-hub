
-- Adiciona colunas de rastreamento de atividade e função de update
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ;

-- Função para o usuário logado atualizar sua própria atividade
CREATE OR REPLACE FUNCTION public.touch_company_activity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _company_id uuid;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT company_id INTO _company_id
    FROM public.user_roles
    WHERE user_id = _uid AND company_id IS NOT NULL
    LIMIT 1;
  IF _company_id IS NULL THEN RETURN; END IF;
  UPDATE public.companies
    SET last_activity = now(),
        last_login = COALESCE(last_login, now())
    WHERE id = _company_id;
END;
$$;

-- Marca login (força atualização do last_login)
CREATE OR REPLACE FUNCTION public.touch_company_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _company_id uuid;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT company_id INTO _company_id
    FROM public.user_roles
    WHERE user_id = _uid AND company_id IS NOT NULL
    LIMIT 1;
  IF _company_id IS NULL THEN RETURN; END IF;
  UPDATE public.companies
    SET last_login = now(),
        last_activity = now()
    WHERE id = _company_id;
END;
$$;

-- Atualiza mark_payment_informed para aceitar método de pagamento opcional
CREATE OR REPLACE FUNCTION public.mark_payment_informed(_method text DEFAULT NULL)
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
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT company_id INTO _company_id
  FROM public.user_roles
  WHERE user_id = _uid AND role IN ('owner','manager')
  LIMIT 1;

  IF _company_id IS NULL THEN RAISE EXCEPTION 'Sem empresa vinculada'; END IF;

  SELECT status INTO _current_status FROM public.companies WHERE id = _company_id;
  IF _current_status NOT IN ('aguardando_pagamento','cancelado','bloqueado') THEN
    RAISE EXCEPTION 'Status atual (%) nao permite informar pagamento', _current_status;
  END IF;

  UPDATE public.companies
    SET status = 'pagamento_em_analise',
        payment_informed_at = now(),
        payment_status = 'pending',
        payment_method = COALESCE(_method, payment_method)
  WHERE id = _company_id
    AND (_method IS NULL OR _method IN ('PIX','Cartão','Dinheiro','Outro'));

  -- Se o método era inválido, ainda assim atualizamos sem alterar o método
  IF NOT FOUND THEN
    UPDATE public.companies
      SET status = 'pagamento_em_analise',
          payment_informed_at = now(),
          payment_status = 'pending'
    WHERE id = _company_id;
  END IF;
END;
$$;

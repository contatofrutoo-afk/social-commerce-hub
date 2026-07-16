
-- 1. Expandir CHECK do status
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_status_check;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_status_check
  CHECK (status = ANY (ARRAY['ativo','bloqueado','teste','cancelado','aguardando_pagamento','pagamento_em_analise']));

-- 2. Novos campos
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS payment_informed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_confirmation_date timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_reason text;

-- 3. Novas empresas: nascem como aguardando_pagamento
CREATE OR REPLACE FUNCTION private.claim_own_company(_name text, _slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _company_id uuid;
  _existing uuid;
  _final_slug text;
  _is_admin boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Super admin não recebe empresa automaticamente
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'admin') INTO _is_admin;
  IF _is_admin THEN
    RETURN NULL;
  END IF;

  SELECT company_id INTO _existing FROM public.user_roles WHERE user_id = _uid LIMIT 1;
  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  _final_slug := COALESCE(NULLIF(trim(_slug), ''), 'empresa-' || substr(_uid::text, 1, 8));
  IF EXISTS (SELECT 1 FROM public.companies WHERE slug = _final_slug) THEN
    _final_slug := _final_slug || '-' || substr(gen_random_uuid()::text, 1, 6);
  END IF;

  INSERT INTO public.companies (name, slug, status, payment_status)
  VALUES (COALESCE(NULLIF(trim(_name), ''), 'Minha Empresa'), _final_slug, 'aguardando_pagamento', 'pending')
  RETURNING id INTO _company_id;

  INSERT INTO public.user_roles (user_id, company_id, role)
  VALUES (_uid, _company_id, 'owner');

  RETURN _company_id;
END;
$function$;

-- 4. Dono informa pagamento
CREATE OR REPLACE FUNCTION public.mark_payment_informed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
    RAISE EXCEPTION 'Status atual (%) não permite informar pagamento', _current_status;
  END IF;

  UPDATE public.companies
    SET status = 'pagamento_em_analise',
        payment_informed_at = now(),
        payment_status = 'pending'
  WHERE id = _company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_payment_informed() TO authenticated;

-- 5. Admin altera status
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
        blocked_at = CASE WHEN _new_status = 'bloqueado' THEN now() ELSE blocked_at END,
        blocked_reason = CASE WHEN _new_status = 'bloqueado' THEN _reason ELSE blocked_reason END
  WHERE id = _company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_company_status(uuid, text, text) TO authenticated;

-- 6. Auto-promoção do super admin no primeiro login
CREATE OR REPLACE FUNCTION public.ensure_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public','auth'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  IF lower(_email) = 'admin@weaze.com.br' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'admin')
    ON CONFLICT DO NOTHING;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_super_admin() TO authenticated;

-- 7. user_roles: permitir company_id NULL para o super admin
ALTER TABLE public.user_roles ALTER COLUMN company_id DROP NOT NULL;

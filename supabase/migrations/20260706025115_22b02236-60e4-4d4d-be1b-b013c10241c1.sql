
-- Drop always-true insert policy; company creation now flows through RPC
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;

-- Move claim_own_company to private schema
DROP FUNCTION IF EXISTS public.claim_own_company(text, text);

CREATE OR REPLACE FUNCTION private.claim_own_company(_name text, _slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _company_id uuid;
  _existing uuid;
  _final_slug text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT company_id INTO _existing
  FROM public.user_roles
  WHERE user_id = _uid
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  _final_slug := COALESCE(NULLIF(trim(_slug), ''), 'empresa-' || substr(_uid::text, 1, 8));

  IF EXISTS (SELECT 1 FROM public.companies WHERE slug = _final_slug) THEN
    _final_slug := _final_slug || '-' || substr(gen_random_uuid()::text, 1, 6);
  END IF;

  INSERT INTO public.companies (name, slug)
  VALUES (COALESCE(NULLIF(trim(_name), ''), 'Minha Empresa'), _final_slug)
  RETURNING id INTO _company_id;

  INSERT INTO public.user_roles (user_id, company_id, role)
  VALUES (_uid, _company_id, 'owner');

  RETURN _company_id;
END;
$$;

REVOKE ALL ON FUNCTION private.claim_own_company(text, text) FROM PUBLIC;

-- Thin public wrapper: SECURITY INVOKER, just delegates to private impl.
CREATE OR REPLACE FUNCTION public.claim_own_company(_name text, _slug text)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.claim_own_company(_name, _slug);
$$;

REVOKE ALL ON FUNCTION public.claim_own_company(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_own_company(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.claim_own_company(text, text) TO authenticated;

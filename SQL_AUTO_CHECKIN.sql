-- ============================================================
-- AUTO CHECK-IN — Cole no SQL Editor do Supabase e rode
-- Cria as funcoes auto_checkin (private + public wrapper)
-- ============================================================

-- 1. Funcao privada: verifica customer, cooldown 4h, insere checkin
CREATE OR REPLACE FUNCTION private.auto_checkin(
  _customer_id uuid,
  _token uuid,
  _company_id uuid,
  _table_id uuid DEFAULT NULL,
  _source text DEFAULT 'link'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last timestamptz;
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = _customer_id AND company_id = _company_id) THEN
    RAISE EXCEPTION 'company mismatch';
  END IF;

  -- Verifica ultimo check-in deste customer nesta empresa
  SELECT created_at INTO v_last
  FROM checkins
  WHERE customer_id = _customer_id AND company_id = _company_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Cooldown 4h — se ja tem check-in recente, nao duplica
  IF v_last IS NOT NULL AND (now() - v_last) < interval '4 hours' THEN
    RETURN false;
  END IF;

  INSERT INTO checkins (customer_id, company_id, table_id, context, source)
  VALUES (_customer_id, _company_id, _table_id, 'sozinho'::visit_context, COALESCE(_source, 'link'));

  RETURN true;
END;
$$;

-- 2. Wrapper publico (chamavel via PostgREST)
CREATE OR REPLACE FUNCTION public.auto_checkin(
  _customer_id uuid,
  _token uuid,
  _company_id uuid,
  _table_id uuid DEFAULT NULL,
  _source text DEFAULT 'link'
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.auto_checkin(_customer_id, _token, _company_id, _table_id, _source);
$$;

-- 3. Permissoes
REVOKE ALL ON FUNCTION public.auto_checkin(uuid, uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_checkin(uuid, uuid, uuid, uuid, text) TO anon, authenticated;

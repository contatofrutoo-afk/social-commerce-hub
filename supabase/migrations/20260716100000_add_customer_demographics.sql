-- ============================================================
-- ETAPA 1: Adicionar campos Sexo e Faixa Etária aos clientes
-- ============================================================

-- 1. Adicionar colunas demográficas à tabela customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS age_range text;

-- 2. Recriar private.upsert_customer_visit com novos parâmetros opcionais
DROP FUNCTION IF EXISTS private.upsert_customer_visit(uuid, text, text);
CREATE OR REPLACE FUNCTION private.upsert_customer_visit(
  _company_id uuid, _name text, _whatsapp text,
  _gender text DEFAULT NULL, _age_range text DEFAULT NULL
)
RETURNS TABLE(customer_id uuid, session_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_token uuid;
BEGIN
  IF _name IS NULL OR length(btrim(_name)) = 0 THEN RAISE EXCEPTION 'name required'; END IF;
  IF _whatsapp IS NULL OR length(btrim(_whatsapp)) = 0 THEN RAISE EXCEPTION 'whatsapp required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id) THEN
    RAISE EXCEPTION 'invalid company';
  END IF;
  SELECT c.id, c.session_token INTO v_id, v_token
    FROM public.customers c
    WHERE c.company_id = _company_id AND c.whatsapp = _whatsapp;
  IF v_id IS NULL THEN
    INSERT INTO public.customers (company_id, name, whatsapp, gender, age_range)
    VALUES (_company_id, _name, _whatsapp, _gender, _age_range)
    RETURNING id, public.customers.session_token INTO v_id, v_token;
  ELSE
    UPDATE public.customers
      SET name = _name,
          last_visit_at = now(),
          visit_count = COALESCE(visit_count, 0) + 1,
          gender = COALESCE(_gender, gender),
          age_range = COALESCE(_age_range, age_range)
      WHERE id = v_id;
  END IF;
  RETURN QUERY SELECT v_id, v_token;
END;
$$;

-- 3. Recriar public wrapper para upsert_customer_visit
DROP FUNCTION IF EXISTS public.upsert_customer_visit(uuid, text, text);
CREATE OR REPLACE FUNCTION public.upsert_customer_visit(
  _company_id uuid, _name text, _whatsapp text,
  _gender text DEFAULT NULL, _age_range text DEFAULT NULL
)
RETURNS TABLE(customer_id uuid, session_token uuid)
LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
  SELECT * FROM private.upsert_customer_visit(_company_id, _name, _whatsapp, _gender, _age_range);
$$;

-- 4. Recriar private.update_customer_self com novos parâmetros opcionais
DROP FUNCTION IF EXISTS private.update_customer_self(uuid, uuid, text, text, text);
CREATE OR REPLACE FUNCTION private.update_customer_self(
  _customer_id uuid, _token uuid, _name text, _whatsapp text, _avatar_url text,
  _gender text DEFAULT NULL, _age_range text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public.customers
    SET name = COALESCE(_name, name),
        whatsapp = COALESCE(_whatsapp, whatsapp),
        avatar_url = _avatar_url,
        gender = COALESCE(_gender, gender),
        age_range = COALESCE(_age_range, age_range)
    WHERE id = _customer_id;
END;
$$;

-- 5. Recriar public wrapper para update_customer_self
DROP FUNCTION IF EXISTS public.update_customer_self(uuid, uuid, text, text, text);
CREATE OR REPLACE FUNCTION public.update_customer_self(
  _customer_id uuid, _token uuid, _name text, _whatsapp text, _avatar_url text,
  _gender text DEFAULT NULL, _age_range text DEFAULT NULL
)
RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
  SELECT private.update_customer_self(_customer_id, _token, _name, _whatsapp, _avatar_url, _gender, _age_range);
$$;

-- 6. Atualizar grants para as novas assinaturas
REVOKE ALL ON FUNCTION public.upsert_customer_visit(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_customer_visit(uuid, text, text, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.update_customer_self(uuid, uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_customer_self(uuid, uuid, text, text, text, text, text) TO anon, authenticated;

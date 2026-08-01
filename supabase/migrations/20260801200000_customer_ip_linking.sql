-- ============================================================
-- VINCULAÇÃO POR IP: perfil salvo aparece em Clientes e Atendimento
-- (seções Mesa e Loja) sempre que o mesmo usuário acessa pelo mesmo IP,
-- seja no celular ou no PC.
--
-- Contexto: o onboarding anônimo (QR) identifica o cliente pelo whatsapp
-- = "anon-<id>", que é LOCAL do aparelho (localStorage). Assim o mesmo
-- usuário no celular e no PC vira dois clientes distintos, e o nome/avatar
-- salvos no Perfil não acompanham de um aparelho para o outro.
--
-- Correção:
--  1. customers.last_ip guarda o IP público de cada acesso.
--  2. upsert_customer_visit (onboarding) recebe o IP e, quando o aparelho
--     é novo (sem perfil salvo), reusa o cliente da mesma empresa que já
--     tem perfil salvo e o mesmo IP — o nome/avatar aparecem na hora.
--  3. Linhas anônimas "Visitante" com o mesmo IP são migradas para o
--     cliente canônico, evitando duplicatas em Clientes/Atendimento.
--  4. update_customer_self (salvar Perfil) também grava o IP.
-- Idempotente: pode ser executado quantas vezes for necessário.
-- ============================================================

-- 1) Coluna last_ip
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_ip text;

-- ============================================================
-- 2) Helper privado: migra todos os dados de um cliente para outro.
--    Usado para fundir linhas anônimas duplicadas na canônica.
-- ============================================================
CREATE OR REPLACE FUNCTION private.merge_customer_data(_from uuid, _to uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _from IS NULL OR _to IS NULL OR _from = _to THEN
    RETURN;
  END IF;

  UPDATE public.checkins SET customer_id = _to WHERE checkins.customer_id = _from;
  UPDATE public.posts SET customer_id = _to WHERE posts.customer_id = _from;
  UPDATE public.comments SET customer_id = _to WHERE comments.customer_id = _from;
  UPDATE public.orders SET customer_id = _to WHERE orders.customer_id = _from;
  UPDATE public.consent_log SET customer_id = _to WHERE consent_log.customer_id = _from;
  UPDATE public.product_events SET customer_id = _to WHERE product_events.customer_id = _from;

  -- Tabelas com chave composta (post_id/product_id, customer_id): migra sem
  -- conflito (ON CONFLICT DO NOTHING) e descarta os repetidos da duplicada.
  INSERT INTO public.post_reactions (post_id, customer_id, type, created_at)
    SELECT post_id, _to, type, created_at
    FROM public.post_reactions WHERE post_reactions.customer_id = _from
    ON CONFLICT (post_id, customer_id) DO NOTHING;
  DELETE FROM public.post_reactions WHERE post_reactions.customer_id = _from;

  INSERT INTO public.product_likes (product_id, customer_id, created_at)
    SELECT product_id, _to, created_at
    FROM public.product_likes WHERE product_likes.customer_id = _from
    ON CONFLICT (product_id, customer_id) DO NOTHING;
  DELETE FROM public.product_likes WHERE product_likes.customer_id = _from;

  INSERT INTO public.product_wishes (product_id, customer_id, created_at)
    SELECT product_id, _to, created_at
    FROM public.product_wishes WHERE product_wishes.customer_id = _from
    ON CONFLICT (product_id, customer_id) DO NOTHING;
  DELETE FROM public.product_wishes WHERE product_wishes.customer_id = _from;

  DELETE FROM public.customers WHERE id = _from;
END;
$$;

-- ============================================================
-- 3) upsert_customer_visit com IP + vínculo por IP
-- ============================================================
DROP FUNCTION IF EXISTS private.upsert_customer_visit(uuid, text, text);
DROP FUNCTION IF EXISTS private.upsert_customer_visit(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION private.upsert_customer_visit(
  _company_id uuid,
  _name text,
  _whatsapp text,
  _gender text DEFAULT NULL,
  _age_range text DEFAULT NULL,
  _ip_address text DEFAULT NULL
)
RETURNS TABLE(customer_id uuid, session_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_token uuid;
  v_ip text;
  v_is_anon boolean;
  v_merge_from uuid;
BEGIN
  IF _name IS NULL OR length(btrim(_name)) = 0 THEN
    RAISE EXCEPTION 'name required';
  END IF;
  IF _whatsapp IS NULL OR length(btrim(_whatsapp)) = 0 THEN
    RAISE EXCEPTION 'whatsapp required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id) THEN
    RAISE EXCEPTION 'invalid company';
  END IF;

  v_is_anon := btrim(_name) = 'Visitante';
  v_ip := NULLIF(btrim(COALESCE(_ip_address, '')), '');

  -- (a) Mesmo whatsapp (mesmo aparelho reaparecendo) → reusa o cadastro
  SELECT c.id, c.session_token INTO v_id, v_token
    FROM public.customers c
    WHERE c.company_id = _company_id AND c.whatsapp = _whatsapp;

  -- (b) Aparelho novo + mesmo IP de um cliente que JÁ TEM perfil salvo:
  --     reusa o cliente canônico para o nome/avatar aparecerem em Clientes
  --     e Atendimento (Mesa e Loja) independentemente do aparelho.
  IF v_id IS NULL AND v_is_anon AND v_ip IS NOT NULL THEN
    SELECT c.id, c.session_token INTO v_id, v_token
      FROM public.customers c
      WHERE c.company_id = _company_id
        AND c.last_ip = v_ip
        AND btrim(COALESCE(c.name, '')) NOT IN ('Visitante', 'Usuário removido')
      ORDER BY c.last_visit_at DESC NULLS LAST
      LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.customers (company_id, name, whatsapp, gender, age_range, last_ip)
    VALUES (_company_id, _name, _whatsapp, _gender, _age_range, v_ip)
    RETURNING id, public.customers.session_token INTO v_id, v_token;
  ELSE
    UPDATE public.customers
      SET last_visit_at = now(),
          visit_count = COALESCE(visit_count, 0) + 1,
          last_ip = COALESCE(v_ip, last_ip),
          gender = COALESCE(_gender, gender),
          age_range = COALESCE(_age_range, age_range)
      WHERE id = v_id;
  END IF;

  -- (c) Limpeza: funde outras linhas anônimas "Visitante" do mesmo IP na
  --     canônica, para o mesmo usuário não aparecer duplicado em
  --     Clientes/Atendimento.
  IF v_is_anon AND v_ip IS NOT NULL THEN
    FOR v_merge_from IN
      SELECT c2.id
      FROM public.customers c2
      WHERE c2.company_id = _company_id
        AND c2.id <> v_id
        AND c2.last_ip = v_ip
        AND btrim(COALESCE(c2.name, '')) = 'Visitante'
    LOOP
      PERFORM private.merge_customer_data(v_merge_from, v_id);
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_id, v_token;
END;
$$;

DROP FUNCTION IF EXISTS public.upsert_customer_visit(uuid, text, text);
DROP FUNCTION IF EXISTS public.upsert_customer_visit(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.upsert_customer_visit(
  _company_id uuid,
  _name text,
  _whatsapp text,
  _gender text DEFAULT NULL,
  _age_range text DEFAULT NULL,
  _ip_address text DEFAULT NULL
)
RETURNS TABLE(customer_id uuid, session_token uuid)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM private.upsert_customer_visit(_company_id, _name, _whatsapp, _gender, _age_range, _ip_address);
$$;

REVOKE ALL ON FUNCTION public.upsert_customer_visit(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_customer_visit(uuid, text, text, text, text, text) TO anon, authenticated;

-- ============================================================
-- 4) update_customer_self: grava também o IP do aparelho
-- ============================================================
DROP FUNCTION IF EXISTS private.update_customer_self(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS private.update_customer_self(uuid, uuid, text, text, text, text, text);

CREATE OR REPLACE FUNCTION private.update_customer_self(
  _customer_id uuid,
  _token uuid,
  _name text,
  _whatsapp text,
  _avatar_url text,
  _gender text DEFAULT NULL,
  _age_range text DEFAULT NULL,
  _ip_address text DEFAULT NULL
)
RETURNS TABLE(customer_id uuid, session_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_company_id uuid;
  v_new_whatsapp text;
  v_other_id uuid;
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT company_id INTO v_company_id FROM public.customers WHERE id = _customer_id;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_new_whatsapp := NULLIF(btrim(COALESCE(_whatsapp, '')), '');

  -- Mesmo whatsapp já pertence a outro cliente da mesma empresa?
  IF v_new_whatsapp IS NOT NULL THEN
    SELECT id INTO v_other_id
      FROM public.customers
      WHERE company_id = v_company_id
        AND whatsapp = v_new_whatsapp
        AND id <> _customer_id
      LIMIT 1;
  END IF;

  IF v_other_id IS NOT NULL THEN
    -- Mescla o perfil na linha canônica (a que já possui o whatsapp).
    -- O nome anônimo "Visitante" nunca sobrescreve um nome real.
    UPDATE public.customers
      SET name = CASE
                   WHEN NULLIF(btrim(COALESCE(_name, '')), '') IS NULL THEN name
                   WHEN btrim(COALESCE(_name, '')) = 'Visitante' THEN name
                   ELSE btrim(_name)
                 END,
          avatar_url = CASE WHEN btrim(COALESCE(_avatar_url, '')) = '' THEN avatar_url ELSE _avatar_url END,
          gender = COALESCE(_gender, gender),
          age_range = COALESCE(_age_range, age_range),
          last_ip = COALESCE(_ip_address, last_ip),
          session_token = _token
      WHERE id = v_other_id;

    -- Transfere todos os registros da linha duplicada para a canônica.
    PERFORM private.merge_customer_data(_customer_id, v_other_id);

    RETURN QUERY SELECT v_other_id, _token;
    RETURN;
  END IF;

  -- Sem conflito: atualiza a própria linha normalmente
  UPDATE public.customers
    SET name = COALESCE(NULLIF(btrim(COALESCE(_name, '')), ''), name),
        whatsapp = COALESCE(v_new_whatsapp, whatsapp),
        avatar_url = CASE WHEN btrim(COALESCE(_avatar_url, '')) = '' THEN avatar_url ELSE _avatar_url END,
        gender = _gender,
        age_range = _age_range,
        last_ip = COALESCE(_ip_address, last_ip)
  WHERE id = _customer_id;

  RETURN QUERY SELECT _customer_id, _token;
END;
$$;

DROP FUNCTION IF EXISTS public.update_customer_self(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.update_customer_self(uuid, uuid, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.update_customer_self(
  _customer_id uuid,
  _token uuid,
  _name text,
  _whatsapp text,
  _avatar_url text,
  _gender text DEFAULT NULL,
  _age_range text DEFAULT NULL,
  _ip_address text DEFAULT NULL
)
RETURNS TABLE(customer_id uuid, session_token uuid)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM private.update_customer_self(_customer_id, _token, _name, _whatsapp, _avatar_url, _gender, _age_range, _ip_address);
$$;

REVOKE ALL ON FUNCTION public.update_customer_self(uuid, uuid, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_customer_self(uuid, uuid, text, text, text, text, text, text) TO anon, authenticated;

-- ============================================================
-- VERIFICAÇÃO (rodar depois de aplicar o script):
--
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'customers'
--     AND column_name = 'last_ip';           -- → 1 linha
--
-- SELECT p.proname, pg_get_function_arguments(p.oid) AS args
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname IN ('public','private')
--     AND p.proname IN ('upsert_customer_visit','update_customer_self')
--   ORDER BY p.proname, n.nspname;
--   -- Esperado: upsert_customer_visit com 6 args, update_customer_self com 8
-- ============================================================

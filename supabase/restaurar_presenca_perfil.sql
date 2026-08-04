-- ============================================================
-- RESTAURAR PRESENÇA EM TEMPO REAL + SALVAR PERFIL
-- Rode este arquivo ÚNICO no Supabase SQL Editor (SQL > New query,
-- colar e Run). Seguro reexecutar quantas vezes precisar.
--
-- O que ele faz:
--  1. Garante a coluna customers.last_ip (vínculo por IP).
--  2. Reconstrói as RPCs de sessão/perfil SEM gênero/idade (LGPD):
--     upsert_customer_visit (4 args), get_customer_self (2 args),
--     update_customer_self (6 args), delete_my_data (3 args).
--  3. Reconstrói o check-in automático: auto_checkin (5 args) com
--     cooldown de 4h e encerramento de presenças antigas.
--  4. Reconstrói a lista de presentes: list_service_present_public
--     (com nome/avatar do cliente) usada pelo Atendimento (Mesa/Loja)
--     e pela aba Clientes (círculo verde).
--  5. Reconstrói logout/checkout (encerram TODOS os check-ins ativos).
--
-- IMPORTANTE: remove TODAS as overloads antigas dessas funções
-- (inclusive as com _gender/_age_range) e cria UMA versão canônica
-- de cada uma — eliminando erros de "function not found" (PGRST202) e
-- de "candidate function ambiguous" (PGRST203) no PostgREST.
-- ============================================================

-- ============================================================
-- 1) Coluna last_ip (idempotente)
-- ============================================================
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_ip text;

-- ============================================================
-- 2) Helper privado: valida a sessão do cliente
-- ============================================================
CREATE OR REPLACE FUNCTION private.verify_customer(_customer_id uuid, _token uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = _customer_id AND session_token = _token
  );
$$;

-- ============================================================
-- 3) Helper privado: migra todos os dados de um cliente para outro
--    (funde duplicatas anônimas na linha canônica)
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
-- 4) Remove TODAS as overloads antigas (públicas e privadas) das
--    RPCs abaixo. Public primeiro (o wrapper depende da privada).
-- ============================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private')
      AND p.proname IN (
        'upsert_customer_visit', 'update_customer_self',
        'get_customer_self', 'delete_my_data', 'auto_checkin'
      )
    ORDER BY n.nspname DESC, p.proname
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s)', r.schema, r.name, r.args);
  END LOOP;
END;
$$;

-- Overload legado do auto_checkin (grava em b2c_customers, não usa)
DROP FUNCTION IF EXISTS private.auto_checkin_legacy(uuid, uuid, text, text, text, text);

-- ============================================================
-- 5) upsert_customer_visit — onboarding QR geral / mesa / catálogo.
--    Cria a sessão do cliente; se o mesmo IP já tem perfil salvo,
--    reaproveita o cadastro canônico (nome/avatar aparecem na hora).
-- ============================================================
CREATE OR REPLACE FUNCTION private.upsert_customer_visit(
  _company_id uuid,
  _name text,
  _whatsapp text,
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
    INSERT INTO public.customers (company_id, name, whatsapp, last_ip)
    VALUES (_company_id, _name, _whatsapp, v_ip)
    RETURNING id, public.customers.session_token INTO v_id, v_token;
  ELSE
    UPDATE public.customers
      SET last_visit_at = now(),
          visit_count = COALESCE(visit_count, 0) + 1,
          last_ip = COALESCE(v_ip, last_ip)
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

CREATE OR REPLACE FUNCTION public.upsert_customer_visit(
  _company_id uuid,
  _name text,
  _whatsapp text,
  _ip_address text DEFAULT NULL
)
RETURNS TABLE(customer_id uuid, session_token uuid)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM private.upsert_customer_visit(_company_id, _name, _whatsapp, _ip_address);
$$;

REVOKE ALL ON FUNCTION public.upsert_customer_visit(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_customer_visit(uuid, text, text, text) TO anon, authenticated;

-- ============================================================
-- 6) get_customer_self — leitura do próprio perfil (Perfil)
-- ============================================================
CREATE OR REPLACE FUNCTION private.get_customer_self(_customer_id uuid, _token uuid)
RETURNS SETOF public.customers
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY SELECT * FROM public.customers WHERE id = _customer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_customer_self(_customer_id uuid, _token uuid)
RETURNS SETOF public.customers
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT * FROM private.get_customer_self(_customer_id, _token);
$$;

REVOKE ALL ON FUNCTION public.get_customer_self(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_self(uuid, uuid) TO anon, authenticated;

-- ============================================================
-- 7) update_customer_self — salvar Perfil (avatar, nome, whatsapp).
--    Se o whatsapp já pertence a outro cadastro da mesma empresa,
--    mescla os perfis e devolve o customer_id canônico.
-- ============================================================
CREATE OR REPLACE FUNCTION private.update_customer_self(
  _customer_id uuid,
  _token uuid,
  _name text,
  _whatsapp text,
  _avatar_url text,
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
        last_ip = COALESCE(_ip_address, last_ip)
  WHERE id = _customer_id;

  RETURN QUERY SELECT _customer_id, _token;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_customer_self(
  _customer_id uuid,
  _token uuid,
  _name text,
  _whatsapp text,
  _avatar_url text,
  _ip_address text DEFAULT NULL
)
RETURNS TABLE(customer_id uuid, session_token uuid)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM private.update_customer_self(_customer_id, _token, _name, _whatsapp, _avatar_url, _ip_address);
$$;

REVOKE ALL ON FUNCTION public.update_customer_self(uuid, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_customer_self(uuid, uuid, text, text, text, text) TO anon, authenticated;

-- ============================================================
-- 8) auto_checkin — check-in silencioso do QR/link/catálogo.
--    Cooldown 4h: re-mapeia presença recente (Mesa/Loja), senão
--    encerra ativos antigos e cria UM check-in ativo.
-- ============================================================
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
  v_active_id uuid;
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = _customer_id AND company_id = _company_id) THEN
    RAISE EXCEPTION 'company mismatch';
  END IF;

  -- Último check-in AINDA ATIVO deste cliente nesta empresa
  SELECT id, created_at INTO v_active_id, v_last
  FROM checkins
  WHERE customer_id = _customer_id AND company_id = _company_id
    AND checked_out_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  -- Cooldown 4h: se já há presença recente, não duplica...
  IF v_active_id IS NOT NULL AND (now() - v_last) < interval '4 hours' THEN
    -- ...mas re-mapeia a localização do cliente conforme a origem:
    --   QR da mesa      -> mesa escaneada (_table_id preenchido)
    --   link/QR geral   -> Loja (_table_id NULL)
    UPDATE public.checkins
    SET table_id = _table_id
    WHERE id = v_active_id;
    RETURN false;
  END IF;

  -- Nova visita: encerra os check-ins ativos antigos (nunca fechados)
  -- e cria um único check-in ativo para esta visita.
  UPDATE public.checkins
  SET checked_out_at = now()
  WHERE customer_id = _customer_id
    AND company_id = _company_id
    AND checked_out_at IS NULL;

  INSERT INTO checkins (customer_id, company_id, table_id, context, source)
  VALUES (_customer_id, _company_id, _table_id, 'sozinho'::visit_context, COALESCE(_source, 'link'));

  RETURN true;
END;
$$;

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

REVOKE ALL ON FUNCTION public.auto_checkin(uuid, uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_checkin(uuid, uuid, uuid, uuid, text) TO anon, authenticated;

-- ============================================================
-- 9) list_service_present_public — clientes presentes agora
--    (Atendimento Mesa/Loja e círculo verde da aba Clientes).
--    Traz nome/avatar do cliente e rótulo da mesa.
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_service_present_public(
  _company_id uuid,
  _minutes int DEFAULT 480
)
RETURNS TABLE(
  id uuid,
  company_id uuid,
  customer_id uuid,
  table_id uuid,
  context text,
  source text,
  created_at timestamptz,
  customer_name text,
  customer_avatar_url text,
  customer_visit_count int,
  customer_first_visit_at timestamptz,
  customer_last_visit_at timestamptz,
  table_label text,
  table_slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ch.id,
    ch.company_id,
    ch.customer_id,
    ch.table_id,
    ch.context::text,
    ch.source,
    ch.created_at,
    c.name AS customer_name,
    c.avatar_url AS customer_avatar_url,
    c.visit_count AS customer_visit_count,
    c.first_visit_at AS customer_first_visit_at,
    c.last_visit_at AS customer_last_visit_at,
    t.label AS table_label,
    t.slug AS table_slug
  FROM public.checkins ch
  LEFT JOIN public.customers c ON c.id = ch.customer_id
  LEFT JOIN public.tables t ON t.id = ch.table_id
  WHERE ch.company_id = _company_id
    AND ch.created_at >= now() - make_interval(mins => _minutes)
    AND ch.checked_out_at IS NULL
  ORDER BY ch.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_service_present_public(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_service_present_public(uuid, int) TO anon, authenticated, service_role;

-- ============================================================
-- 10) customer_logout (cliente) + checkout_customer (staff):
--     encerram TODOS os check-ins ativos e invalidam a sessão.
-- ============================================================
CREATE OR REPLACE FUNCTION public.customer_logout(
  _customer_id uuid,
  _token uuid,
  _company_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = _customer_id AND company_id = _company_id
  ) THEN
    RAISE EXCEPTION 'company mismatch';
  END IF;

  UPDATE public.checkins
  SET checked_out_at = now()
  WHERE customer_id = _customer_id
    AND company_id = _company_id
    AND checked_out_at IS NULL;

  UPDATE public.customers
  SET session_token = gen_random_uuid()
  WHERE id = _customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_logout(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_logout(uuid, uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.checkout_customer(
  _staff_user_id uuid,
  _company_id uuid,
  _customer_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _staff_user_id AND company_id = _company_id
  ) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  UPDATE public.checkins
  SET checked_out_at = now()
  WHERE customer_id = _customer_id
    AND company_id = _company_id
    AND checked_out_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active checkin found';
  END IF;

  UPDATE public.customers
  SET session_token = gen_random_uuid()
  WHERE id = _customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_customer(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkout_customer(uuid, uuid, uuid) TO authenticated;

-- ============================================================
-- 11) delete_my_data — anonimiza o cliente (LGPD)
-- ============================================================
CREATE OR REPLACE FUNCTION private.delete_my_data(
  _customer_id uuid,
  _token uuid,
  _company_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE customers
  SET name = 'Usuário removido',
      whatsapp = 'removido',
      avatar_url = NULL,
      session_token = gen_random_uuid()
  WHERE id = _customer_id AND company_id = _company_id;

  INSERT INTO consent_log (customer_id, company_id, consent_type)
  VALUES (_customer_id, _company_id, 'data_deletion');
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_my_data(
  _customer_id uuid,
  _token uuid,
  _company_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.delete_my_data(_customer_id, _token, _company_id);
$$;

REVOKE ALL ON FUNCTION public.delete_my_data(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_data(uuid, uuid, uuid) TO anon, authenticated;

-- ============================================================
-- VERIFICAÇÃO (rodar depois de aplicar o script):
--
-- SELECT p.proname, n.nspname, pg_get_function_arguments(p.oid) AS args
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname IN ('public','private')
--     AND p.proname IN ('upsert_customer_visit','update_customer_self',
--                       'get_customer_self','delete_my_data','auto_checkin',
--                       'list_service_present_public','customer_logout',
--                       'checkout_customer')
--   ORDER BY p.proname, n.nspname;
--   -- Esperado (público):
--   --  upsert_customer_visit(uuid, text, text, text)
--   --  update_customer_self(uuid, uuid, text, text, text, text)
--   --  get_customer_self(uuid, uuid)
--   --  delete_my_data(uuid, uuid, uuid)
--   --  auto_checkin(uuid, uuid, uuid, uuid, text)
--   --  list_service_present_public(uuid, integer)
--   --  customer_logout(uuid, uuid, uuid)
--   --  checkout_customer(uuid, uuid, uuid)
-- ============================================================

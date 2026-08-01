-- ============================================================
-- FIX: salvar Perfil do cliente com WhatsApp duplicado falha com
--   column reference "customer_id" is ambiguous
--   (SQLSTATE 42702, "It could refer to either a PL/pgSQL variable
--    or a table column")
--
-- Causa: private.update_customer_self retorna
--   RETURNS TABLE(customer_id uuid, session_token uuid)
-- e em PL/pgSQL os nomes das colunas de RETURNS TABLE viram
-- variáveis de saída. No ramo de merge (whatsapp já usado por
-- outro registro da mesma empresa), os comandos
--   UPDATE ... WHERE customer_id = _customer_id
--   DELETE ... WHERE customer_id = _customer_id
--   INSERT ... SELECT ... WHERE customer_id = _customer_id
-- ficam ambíguos: `customer_id` pode ser a variável PL/pgSQL ou a
-- coluna das tabelas (checkins, posts, comments, orders, etc.).
--
-- Correção: todas as referências a colunas `customer_id` nas
-- condições são qualificadas com o nome da tabela, eliminando a
-- ambiguidade. Assinatura e retorno (customer_id, session_token)
-- são mantidos — o frontend continua recebendo o mesmo formato.
-- Idempotente: pode ser executado quantas vezes for necessário.
-- ============================================================

-- 1) Recriar private.update_customer_self (remove overloads antigas)
DROP FUNCTION IF EXISTS private.update_customer_self(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS private.update_customer_self(uuid, uuid, text, text, text, text, text);

CREATE OR REPLACE FUNCTION private.update_customer_self(
  _customer_id uuid,
  _token uuid,
  _name text,
  _whatsapp text,
  _avatar_url text,
  _gender text DEFAULT NULL,
  _age_range text DEFAULT NULL
)
RETURNS TABLE(customer_id uuid, session_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- Se sim, é cadastro duplicado (ex.: linha anônima + linha real).
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
          session_token = _token
      WHERE id = v_other_id;

    -- Transfere os registros da linha duplicada para a canônica, para que o
    -- nome salvo apareça em Clientes e na presença de Atendimento (Loja/Mesas).
    -- Obs.: as condições são qualificadas com o nome da tabela porque
    -- `customer_id` também é o nome de uma coluna de saída de RETURNS TABLE
    -- (variável PL/pgSQL), o que tornaria a referência ambígua.
    UPDATE public.checkins SET customer_id = v_other_id WHERE checkins.customer_id = _customer_id;
    UPDATE public.posts SET customer_id = v_other_id WHERE posts.customer_id = _customer_id;
    UPDATE public.comments SET customer_id = v_other_id WHERE comments.customer_id = _customer_id;
    UPDATE public.orders SET customer_id = v_other_id WHERE orders.customer_id = _customer_id;
    UPDATE public.consent_log SET customer_id = v_other_id WHERE consent_log.customer_id = _customer_id;
    UPDATE public.product_events SET customer_id = v_other_id WHERE product_events.customer_id = _customer_id;

    -- Tabelas com chave composta (post_id/product_id, customer_id): migra sem
    -- conflito (ON CONFLICT DO NOTHING) e descarta os repetidos da duplicada.
    INSERT INTO public.post_reactions (post_id, customer_id, type, created_at)
      SELECT post_id, v_other_id, type, created_at
      FROM public.post_reactions WHERE post_reactions.customer_id = _customer_id
      ON CONFLICT (post_id, customer_id) DO NOTHING;
    DELETE FROM public.post_reactions WHERE post_reactions.customer_id = _customer_id;

    INSERT INTO public.product_likes (product_id, customer_id, created_at)
      SELECT product_id, v_other_id, created_at
      FROM public.product_likes WHERE product_likes.customer_id = _customer_id
      ON CONFLICT (product_id, customer_id) DO NOTHING;
    DELETE FROM public.product_likes WHERE product_likes.customer_id = _customer_id;

    INSERT INTO public.product_wishes (product_id, customer_id, created_at)
      SELECT product_id, v_other_id, created_at
      FROM public.product_wishes WHERE product_wishes.customer_id = _customer_id
      ON CONFLICT (product_id, customer_id) DO NOTHING;
    DELETE FROM public.product_wishes WHERE product_wishes.customer_id = _customer_id;

    -- Remove o cadastro duplicado (dados já migrados acima)
    DELETE FROM public.customers WHERE id = _customer_id;

    RETURN QUERY SELECT v_other_id, _token;
    RETURN;
  END IF;

  -- Sem conflito: atualiza a própria linha normalmente
  UPDATE public.customers
  SET name = COALESCE(NULLIF(btrim(COALESCE(_name, '')), ''), name),
      whatsapp = COALESCE(v_new_whatsapp, whatsapp),
      avatar_url = CASE WHEN btrim(COALESCE(_avatar_url, '')) = '' THEN avatar_url ELSE _avatar_url END,
      gender = _gender,
      age_range = _age_range
  WHERE id = _customer_id;

  RETURN QUERY SELECT _customer_id, _token;
END;
$$;

-- 2) Recriar wrapper público (mesma assinatura/retorno)
DROP FUNCTION IF EXISTS public.update_customer_self(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.update_customer_self(uuid, uuid, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.update_customer_self(
  _customer_id uuid,
  _token uuid,
  _name text,
  _whatsapp text,
  _avatar_url text,
  _gender text DEFAULT NULL,
  _age_range text DEFAULT NULL
)
RETURNS TABLE(customer_id uuid, session_token uuid)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM private.update_customer_self(_customer_id, _token, _name, _whatsapp, _avatar_url, _gender, _age_range);
$$;

REVOKE ALL ON FUNCTION public.update_customer_self(uuid, uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_customer_self(uuid, uuid, text, text, text, text, text) TO anon, authenticated;

-- ============================================================
-- 3) FIX relacionado: delete_my_data usava whatsapp fixo 'removido',
--    que violava a constraint única (company_id, whatsapp) quando o
--    segundo cliente da mesma empresa solicitava exclusão
--    (erro: duplicate key value violates unique constraint).
--    Agora o placeholder é único por exclusão.
-- ============================================================
DROP FUNCTION IF EXISTS private.delete_my_data(uuid, uuid, uuid);

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

  -- Anonymize personal data instead of hard delete
  UPDATE customers
  SET name = 'Usuário removido',
      whatsapp = 'removido-' || gen_random_uuid()::text,
      avatar_url = NULL,
      gender = NULL,
      age_range = NULL,
      session_token = gen_random_uuid()
  WHERE id = _customer_id AND company_id = _company_id;

  -- Log the deletion consent
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
-- SELECT
--   exists(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--          WHERE n.nspname = 'public'
--            AND p.proname = 'update_customer_self'
--            AND p.pronargs = 7) AS update_self_ok,
--   exists(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--          WHERE n.nspname = 'private'
--            AND p.proname = 'update_customer_self'
--            AND p.pronargs = 7) AS private_update_self_ok;
-- ============================================================

-- ============================================================
-- Restaurar editar/excluir no feed (como comércio e como usuário)
-- Correções:
--   1. posts ganha coluna updated_at (o RPC update_customer_post
--      já referenciava updated_at = now(), mas a coluna nunca
--      existia -> editar quebrava com 'column updated_at does not exist').
--   2. update_customer_post volta a permitir:
--        - autor (customer) editando posts de cliente
--        - company member editando posts do estabelecimento (business)
--   3. delete_customer_post volta a permitir:
--        - autor excluindo posts próprios de cliente
--        - company member excluindo qualquer post da empresa (moderação)
-- ============================================================

-- 1. Garante a coluna updated_at em posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. RPC: editar postagem
--    customer posts: somente o autor
--    business posts: somente membro da empresa
CREATE OR REPLACE FUNCTION private.update_customer_post(
  _customer_id uuid,
  _token uuid,
  _post_id uuid,
  _text text,
  _image_url text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  post_row record;
  cust_company uuid;
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  SELECT id, company_id, author_type, customer_id INTO post_row
  FROM public.posts WHERE id = _post_id;

  IF post_row IS NULL THEN
    RAISE EXCEPTION 'post not found';
  END IF;

  SELECT company_id INTO cust_company FROM public.customers WHERE id = _customer_id;

  IF post_row.author_type = 'customer' THEN
    IF post_row.customer_id <> _customer_id THEN
      RAISE EXCEPTION 'not allowed';
    END IF;
  ELSIF post_row.author_type = 'business' THEN
    IF cust_company IS NULL OR cust_company <> post_row.company_id THEN
      RAISE EXCEPTION 'not allowed';
    END IF;
  ELSE
    RAISE EXCEPTION 'not allowed';
  END IF;

  UPDATE public.posts
  SET text = _text,
      image_url = NULLIF(_image_url, ''),
      updated_at = now()
  WHERE id = _post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_customer_post(
  _customer_id uuid, _token uuid, _post_id uuid, _text text, _image_url text
) RETURNS void LANGUAGE sql SET search_path = public AS $$
  SELECT private.update_customer_post(_customer_id, _token, _post_id, _text, _image_url);
$$;

REVOKE ALL ON FUNCTION public.update_customer_post(uuid, uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_customer_post(uuid, uuid, uuid, text, text) TO anon, authenticated;

-- 3. RPC: excluir postagem
--    autor exclui posts próprios; company member exclui qualquer post da empresa
CREATE OR REPLACE FUNCTION private.delete_customer_post(
  _customer_id uuid,
  _token uuid,
  _post_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  post_row record;
  cust_company uuid;
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  SELECT id, company_id, author_type, customer_id INTO post_row
  FROM public.posts WHERE id = _post_id;

  IF post_row IS NULL THEN
    RAISE EXCEPTION 'post not found';
  END IF;

  SELECT company_id INTO cust_company FROM public.customers WHERE id = _customer_id;

  IF post_row.author_type = 'customer' THEN
    IF post_row.customer_id = _customer_id THEN
      NULL;
    ELSIF cust_company IS NOT NULL AND cust_company = post_row.company_id THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'not allowed';
    END IF;
  ELSIF post_row.author_type = 'business' THEN
    IF cust_company IS NULL OR cust_company <> post_row.company_id THEN
      RAISE EXCEPTION 'not allowed';
    END IF;
  ELSE
    RAISE EXCEPTION 'not allowed';
  END IF;

  DELETE FROM public.posts WHERE id = _post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_customer_post(
  _customer_id uuid, _token uuid, _post_id uuid
) RETURNS void LANGUAGE sql SET search_path = public AS $$
  SELECT private.delete_customer_post(_customer_id, _token, _post_id);
$$;

REVOKE ALL ON FUNCTION public.delete_customer_post(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_customer_post(uuid, uuid, uuid) TO anon, authenticated;

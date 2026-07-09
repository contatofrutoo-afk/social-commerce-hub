-- ============================================================
-- Editar e excluir postagens de clientes via RPC (session-token)
-- ============================================================

-- 1. RPC: editar postagem do cliente (valida token + ownership)
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
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  SELECT id, company_id, author_type, customer_id INTO post_row
  FROM public.posts WHERE id = _post_id;

  IF post_row IS NULL THEN
    RAISE EXCEPTION 'post not found';
  END IF;

  IF post_row.author_type <> 'customer' OR post_row.customer_id <> _customer_id THEN
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

-- 2. RPC: excluir postagem do cliente (valida token + ownership)
CREATE OR REPLACE FUNCTION private.delete_customer_post(
  _customer_id uuid,
  _token uuid,
  _post_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  post_row record;
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  SELECT id, author_type, customer_id INTO post_row
  FROM public.posts WHERE id = _post_id;

  IF post_row IS NULL THEN
    RAISE EXCEPTION 'post not found';
  END IF;

  IF post_row.author_type <> 'customer' OR post_row.customer_id <> _customer_id THEN
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

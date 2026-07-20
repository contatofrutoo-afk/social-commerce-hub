-- ============================================================
-- Corrigir delete_customer_post: somente o autor pode excluir
-- Antes: autor OU company member (moderacao)
-- Agora: apenas autor
-- ============================================================

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

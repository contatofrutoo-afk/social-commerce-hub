-- Permite que o próprio cliente exclua um pedido da lista "Meus Pedidos".
-- O anon não tem DELETE em orders (RLS/grants), então o delete passa por uma
-- RPC SECURITY DEFINER que valida o session_token e a posse do pedido.

CREATE OR REPLACE FUNCTION private.delete_customer_order(
  _order_id uuid,
  _customer_id uuid,
  _token uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM orders WHERE id = _order_id AND customer_id = _customer_id
  ) THEN
    RAISE EXCEPTION 'not found';
  END IF;
  DELETE FROM orders WHERE id = _order_id;
END;
$$;

-- O wrapper é VOLATILE (padrão): funções que escrevem NÃO podem ser STABLE,
-- senão o DELETE roda em transação somente-leitura e falha. Usa DROP + CREATE
-- porque CREATE OR REPLACE não permite trocar a volatilidade.
DROP FUNCTION IF EXISTS public.delete_customer_order(uuid, uuid, uuid);
CREATE FUNCTION public.delete_customer_order(
  _order_id uuid,
  _customer_id uuid,
  _token uuid)
RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
  SELECT private.delete_customer_order(_order_id, _customer_id, _token);
$$;

REVOKE ALL ON FUNCTION public.delete_customer_order(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_customer_order(uuid, uuid, uuid) TO anon, authenticated;

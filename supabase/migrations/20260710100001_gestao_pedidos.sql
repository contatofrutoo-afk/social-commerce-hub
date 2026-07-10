-- ============================================================
-- Gestão de Pedidos — Excluir itens + Concluir com registro de venda
-- ============================================================

-- 1. Função: excluir item do pedido e recalcular total
--    Se não sobrar nenhum item, deleta o pedido inteiro.
CREATE OR REPLACE FUNCTION public.delete_order_item(_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_remaining int;
  v_new_total numeric(10,2);
  v_order_deleted boolean := false;
BEGIN
  -- Busca o order_id do item antes de deletar
  SELECT order_id INTO v_order_id
    FROM public.order_items
    WHERE id = _item_id;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;

  -- Deleta o item
  DELETE FROM public.order_items WHERE id = _item_id;

  -- Conta itens restantes
  SELECT count(*) INTO v_remaining
    FROM public.order_items
    WHERE order_id = v_order_id;

  IF v_remaining = 0 THEN
    -- Sem itens → deleta o pedido inteiro
    DELETE FROM public.orders WHERE id = v_order_id;
    v_order_deleted := true;
  ELSE
    -- Recalcula total
    SELECT COALESCE(SUM(quantity * unit_price), 0)
      INTO v_new_total
      FROM public.order_items
      WHERE order_id = v_order_id;

    UPDATE public.orders SET total = v_new_total WHERE id = v_order_id;
  END IF;

  RETURN jsonb_build_object(
    'deleted', v_order_deleted,
    'remaining_items', v_remaining,
    'new_total', COALESCE(v_new_total, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_order_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_order_item(uuid) TO authenticated;

-- 2. Função: concluir pedido e registrar como venda
--    Marca status = completed, insere product_events (purchase),
--    e atualiza contadores do produto (order_count, revenue, unique_customers).
CREATE OR REPLACE FUNCTION public.complete_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_item record;
BEGIN
  -- Busca o pedido
  SELECT id, company_id, customer_id, status
    INTO v_order
    FROM public.orders
    WHERE id = _order_id;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_order.status = 'completed' THEN
    RETURN; -- já concluído, nada a fazer
  END IF;

  -- Marca como concluído
  UPDATE public.orders SET status = 'completed' WHERE id = _order_id;

  -- Para cada item do pedido, registra evento de compra
  FOR v_item IN
    SELECT oi.product_id, oi.quantity, oi.unit_price
      FROM public.order_items oi
      WHERE oi.order_id = _order_id
  LOOP
    -- Insere evento de compra
    INSERT INTO public.product_events (product_id, company_id, customer_id, event_type, metadata)
      VALUES (
        v_item.product_id,
        v_order.company_id,
        v_order.customer_id,
        'purchase',
        jsonb_build_object(
          'order_id', v_order.id,
          'quantity', v_item.quantity,
          'unit_price', v_item.unit_price
        )
      );

    -- Atualiza contadores do produto (atomicamente)
    UPDATE public.products
      SET order_count = order_count + 1,
          revenue = revenue + (v_item.quantity * v_item.unit_price)
      WHERE id = v_item.product_id;

    -- Atualiza unique_customers (só se o cliente ainda não comprou este produto)
    IF NOT EXISTS (
      SELECT 1 FROM public.product_events
      WHERE product_id = v_item.product_id
        AND customer_id = v_order.customer_id
        AND event_type = 'purchase'
        AND id <> (SELECT id FROM public.product_events ORDER BY created_at DESC LIMIT 1)
    ) THEN
      UPDATE public.products
        SET unique_customers = unique_customers + 1
        WHERE id = v_item.product_id;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_order(uuid) TO authenticated;

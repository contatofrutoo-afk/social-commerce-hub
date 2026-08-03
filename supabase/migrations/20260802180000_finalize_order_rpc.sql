-- ============================================================
-- AÇÃO "FINALIZAR" PARA PEDIDOS DE LOJA (QR/LINK GERAL)
--
-- Pedidos sem mesa (compra na loja via QR/link geral) não têm
-- sequência de preparo: o staff confirma o pagamento no caixa e
-- finaliza de uma vez — status=completed + payment_status=paid.
--
-- Seguro reexecutar.
-- ============================================================

DROP FUNCTION IF EXISTS public.finalize_order(uuid);
DROP FUNCTION IF EXISTS private.finalize_order(uuid, uuid);

CREATE OR REPLACE FUNCTION private.finalize_order(_order_id uuid, _caller uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order record;
  v_item record;
BEGIN
  SELECT id, company_id, customer_id, status, payment_status
    INTO v_order
    FROM public.orders
   WHERE id = _order_id;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  IF _caller IS NULL OR NOT private.has_company_access(_caller, v_order.company_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_order.status = 'completed' THEN
    RETURN;
  END IF;

  UPDATE public.orders
     SET status = 'completed',
         payment_status = CASE
           WHEN payment_status = 'pending' THEN 'paid'
           ELSE payment_status
         END,
         payment_approved_at = CASE
           WHEN payment_status = 'pending' THEN COALESCE(payment_approved_at, now())
           ELSE payment_approved_at
         END
   WHERE id = _order_id;

  FOR v_item IN
    SELECT oi.product_id, oi.quantity, oi.unit_price
      FROM public.order_items oi
     WHERE oi.order_id = _order_id
  LOOP
    INSERT INTO public.product_events (product_id, company_id, customer_id, event_type, metadata)
    VALUES (v_item.product_id, v_order.company_id, v_order.customer_id, 'purchase',
      jsonb_build_object('order_id', v_order.id, 'quantity', v_item.quantity, 'unit_price', v_item.unit_price));
    UPDATE public.products
       SET order_count = order_count + 1,
           revenue = revenue + (v_item.quantity * v_item.unit_price)
     WHERE id = v_item.product_id;
    IF NOT EXISTS (
      SELECT 1 FROM public.product_events
       WHERE product_id = v_item.product_id
         AND customer_id = v_order.customer_id
         AND event_type = 'purchase'
         AND metadata->>'order_id' <> _order_id::text
    ) THEN
      UPDATE public.products SET unique_customers = unique_customers + 1
       WHERE id = v_item.product_id;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_order(_order_id uuid)
RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ SELECT private.finalize_order(_order_id, auth.uid()); $$;

REVOKE ALL ON FUNCTION public.finalize_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_order(uuid) TO authenticated;

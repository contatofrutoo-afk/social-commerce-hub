-- Fase 3 — Checkout Inteligente: RPC de pedidos com forma de pagamento.
-- create_customer_order agora aceita _payment_method e grava o status inicial
-- correspondente: 'counter' → 'payment_at_counter'; demais → 'received'.
-- list_customer_orders passa a devolver orders.payment_method.

DROP FUNCTION IF EXISTS public.create_customer_order(uuid, uuid, uuid, text, json, uuid);
DROP FUNCTION IF EXISTS private.create_customer_order(uuid, uuid, uuid, text, json, uuid);

CREATE OR REPLACE FUNCTION private.create_customer_order(
  _customer_id uuid, _token uuid, _company_id uuid, _note text, _items json,
  _table_id uuid DEFAULT NULL, _payment_method text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_order_id uuid;
  v_total numeric := 0;
  v_table uuid;
  v_status public.order_status;
  item json;
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id=_customer_id AND company_id=_company_id) THEN
    RAISE EXCEPTION 'company mismatch';
  END IF;
  IF _items IS NULL OR json_array_length(_items) = 0 THEN RAISE EXCEPTION 'empty cart'; END IF;
  IF _payment_method IS NOT NULL AND _payment_method NOT IN ('pix', 'card', 'counter') THEN
    RAISE EXCEPTION 'invalid payment method';
  END IF;

  -- resolve table from latest checkin if not provided
  v_table := _table_id;
  IF v_table IS NULL THEN
    SELECT table_id INTO v_table
      FROM checkins
      WHERE customer_id=_customer_id AND company_id=_company_id
      ORDER BY created_at DESC LIMIT 1;
  END IF;

  FOR item IN SELECT * FROM json_array_elements(_items) LOOP
    v_total := v_total + (item->>'price')::numeric * (item->>'quantity')::int;
  END LOOP;

  v_status := CASE WHEN _payment_method = 'counter' THEN 'payment_at_counter' ELSE 'received' END;

  INSERT INTO orders (company_id, customer_id, table_id, note, total, status, payment_method)
    VALUES (_company_id, _customer_id, v_table,
            NULLIF(btrim(COALESCE(_note,'')), ''), v_total, v_status, _payment_method)
    RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, unit_price, note)
  SELECT v_order_id,
         (item->>'productId')::uuid,
         (item->>'quantity')::int,
         (item->>'price')::numeric,
         NULLIF(btrim(COALESCE(item->>'note','')), '')
  FROM json_array_elements(_items) AS item;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_customer_order(
  _customer_id uuid, _token uuid, _company_id uuid, _note text, _items json,
  _table_id uuid DEFAULT NULL, _payment_method text DEFAULT NULL)
RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
  SELECT private.create_customer_order(_customer_id, _token, _company_id, _note, _items, _table_id, _payment_method);
$$;

REVOKE ALL ON FUNCTION public.create_customer_order(uuid, uuid, uuid, text, json, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_order(uuid, uuid, uuid, text, json, uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.list_customer_orders(_customer_id uuid, _token uuid)
RETURNS SETOF json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY
  SELECT to_json(x) FROM (
    SELECT o.id, o.company_id, o.customer_id, o.table_id, o.status, o.total, o.note,
           o.payment_method, o.created_at,
      json_build_object('label', t.label) AS "table",
      COALESCE((
        SELECT json_agg(json_build_object(
          'id',oi.id,'order_id',oi.order_id,'product_id',oi.product_id,
          'quantity',oi.quantity,'unit_price',oi.unit_price,'note',oi.note,
          'product', json_build_object('name', pr.name)))
        FROM order_items oi LEFT JOIN products pr ON pr.id=oi.product_id
        WHERE oi.order_id=o.id
      ), '[]'::json) AS order_items
    FROM orders o LEFT JOIN tables t ON t.id=o.table_id
    WHERE o.customer_id=_customer_id
    ORDER BY o.created_at DESC
  ) x;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_customer_orders(_customer_id uuid, _token uuid)
RETURNS SETOF json
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT * FROM private.list_customer_orders(_customer_id, _token);
$$;

REVOKE ALL ON FUNCTION public.list_customer_orders(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_customer_orders(uuid, uuid) TO anon, authenticated;

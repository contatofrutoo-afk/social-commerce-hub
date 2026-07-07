
-- Fix: "column reference 'item' is ambiguous" em private.create_customer_order
-- O alias da tabela no INSERT ... SELECT conflitava com a variável
-- do loop FOR item IN ... LOOP. Renomeado de "item" para "it".
CREATE OR REPLACE FUNCTION private.create_customer_order(
  _customer_id uuid, _token uuid, _company_id uuid, _note text, _items json, _table_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order_id uuid; v_total numeric := 0; v_table uuid; item json;
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id=_customer_id AND company_id=_company_id) THEN
    RAISE EXCEPTION 'company mismatch';
  END IF;
  IF _items IS NULL OR json_array_length(_items) = 0 THEN RAISE EXCEPTION 'empty cart'; END IF;

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

  INSERT INTO orders (company_id, customer_id, table_id, note, total, status)
    VALUES (_company_id, _customer_id, v_table, NULLIF(btrim(COALESCE(_note,'')), ''), v_total, 'received')
    RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, unit_price, note)
  SELECT v_order_id,
         (it->>'productId')::uuid,
         (it->>'quantity')::int,
         (it->>'price')::numeric,
         NULLIF(btrim(COALESCE(it->>'note','')), '')
  FROM json_array_elements(_items) AS it;

  RETURN v_order_id;
END;
$$;

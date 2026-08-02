-- Fix: "column reference 'item' is ambiguous" reintroduzido pela migração
-- 20260802110000_orders_etapa4_rpc.sql. O alias da tabela no INSERT ... SELECT
-- (AS item) conflita com a variável do loop FOR item IN ... LOOP. Renomeado o
-- alias de "item" para "it" (mesma correção de 20260707200000).

CREATE OR REPLACE FUNCTION private.create_customer_order(
  _customer_id uuid,
  _token uuid,
  _company_id uuid,
  _note text,
  _items json,
  _table_id uuid DEFAULT NULL,
  _payment_method text DEFAULT NULL,
  _payment_provider text DEFAULT NULL,
  _session_id text DEFAULT NULL)
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
  IF _payment_provider IS NOT NULL AND _payment_provider NOT IN ('mercadopago', 'counter') THEN
    RAISE EXCEPTION 'invalid payment provider';
  END IF;

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

  v_status := CASE
    WHEN _payment_provider = 'mercadopago' THEN 'awaiting_payment'::public.order_status
    WHEN _payment_method = 'counter' THEN 'payment_at_counter'::public.order_status
    ELSE 'received'::public.order_status
  END;

  INSERT INTO orders (
    company_id, merchant_id, customer_id, customer_session_id, table_id, note,
    total, subtotal, discount, status, payment_method, payment_provider, payment_status)
  VALUES (
    _company_id, _company_id, _customer_id, NULLIF(btrim(COALESCE(_session_id,'')), ''), v_table,
    NULLIF(btrim(COALESCE(_note,'')), ''), v_total, v_total, 0, v_status,
    _payment_method, _payment_provider,
    CASE WHEN _payment_provider = 'mercadopago' THEN 'pending' ELSE 'pending' END)
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

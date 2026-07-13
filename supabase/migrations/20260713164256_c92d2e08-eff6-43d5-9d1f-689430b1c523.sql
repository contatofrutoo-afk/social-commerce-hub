
-- =====================================================
-- 1. STORAGE POLICIES: remove anon upload + restrict public reads
-- =====================================================
DROP POLICY IF EXISTS "Anon can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anon upload comments" ON storage.objects;
DROP POLICY IF EXISTS "Anon upload publicar" ON storage.objects;
DROP POLICY IF EXISTS "Public read weaze-media public folders" ON storage.objects;

CREATE POLICY "Public read weaze-media public folders"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'weaze-media'
  AND (storage.foldername(name))[1] = ANY (
    ARRAY['logos','business','posts','products','feed','publicar','general']
  )
);

-- Authenticated company staff may read avatars/comments belonging to their company customers
CREATE POLICY "Staff read avatars and comments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'weaze-media'
  AND (storage.foldername(name))[1] = ANY (ARRAY['avatars','comments'])
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE (c.id)::text = (storage.foldername(name))[2]
      AND private.has_company_access(auth.uid(), c.company_id)
  )
);

-- =====================================================
-- 2. Move SECURITY DEFINER bodies to private schema; expose INVOKER wrappers
-- =====================================================

-- get_company_public
CREATE OR REPLACE FUNCTION private.get_company_public(_slug text)
RETURNS TABLE(id uuid, name text, slug text, logo_url text, primary_color text, welcome_message text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.name, c.slug, c.logo_url, c.primary_color, c.welcome_message
  FROM public.companies c WHERE c.slug = _slug LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_company_public(_slug text)
RETURNS TABLE(id uuid, name text, slug text, logo_url text, primary_color text, welcome_message text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT * FROM private.get_company_public(_slug); $$;

-- get_product_public
CREATE OR REPLACE FUNCTION private.get_product_public(_slug text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', p.id, 'company_id', p.company_id, 'company_slug', c.slug,
    'name', p.name, 'slug', p.slug, 'category', p.category, 'price', p.price,
    'image_url', p.image_url, 'available', p.available, 'description', p.description,
    'status', p.status, 'stock_quantity', p.stock_quantity, 'sku', p.sku,
    'internal_code', p.internal_code, 'views_count', p.views_count,
    'scan_count', p.scan_count, 'cart_additions_count', p.cart_additions_count,
    'order_count', p.order_count, 'revenue', p.revenue, 'unique_customers', p.unique_customers
  ) INTO v_result
  FROM products p JOIN companies c ON c.id = p.company_id
  WHERE p.slug = _slug AND p.status = 'active';
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_product_public(_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.get_product_public(_slug); $$;

-- get_table_public
CREATE OR REPLACE FUNCTION private.get_table_public(_company_id uuid, _slug text)
RETURNS TABLE(id uuid, company_id uuid, label text, slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.company_id, t.label, t.slug
  FROM public.tables t
  WHERE t.company_id = _company_id AND t.slug = _slug LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_table_public(_company_id uuid, _slug text)
RETURNS TABLE(id uuid, company_id uuid, label text, slug text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT * FROM private.get_table_public(_company_id, _slug); $$;

-- record_product_event
CREATE OR REPLACE FUNCTION private.record_product_event(
  _product_id uuid, _company_id uuid, _customer_id uuid DEFAULT NULL,
  _event_type text DEFAULT 'view', _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO product_events (product_id, company_id, customer_id, event_type, metadata)
    VALUES (_product_id, _company_id, _customer_id, _event_type, _metadata)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_product_event(
  _product_id uuid, _company_id uuid, _customer_id uuid DEFAULT NULL,
  _event_type text DEFAULT 'view', _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ SELECT private.record_product_event(_product_id, _company_id, _customer_id, _event_type, _metadata); $$;

-- increment_product_counter
CREATE OR REPLACE FUNCTION private.increment_product_counter(_product_id uuid, _field text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  EXECUTE format('UPDATE products SET %I = COALESCE(%I, 0) + 1 WHERE id = $1', _field, _field)
  USING _product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_product_counter(_product_id uuid, _field text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ SELECT private.increment_product_counter(_product_id, _field); $$;

-- complete_order
CREATE OR REPLACE FUNCTION private.complete_order(_order_id uuid, _caller uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_order record; v_item record;
BEGIN
  SELECT id, company_id, customer_id, status INTO v_order FROM public.orders WHERE id = _order_id;
  IF v_order IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF _caller IS NULL OR NOT private.has_company_access(_caller, v_order.company_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_order.status = 'completed' THEN RETURN; END IF;
  UPDATE public.orders SET status = 'completed' WHERE id = _order_id;
  FOR v_item IN SELECT oi.product_id, oi.quantity, oi.unit_price FROM public.order_items oi WHERE oi.order_id = _order_id LOOP
    INSERT INTO public.product_events (product_id, company_id, customer_id, event_type, metadata)
    VALUES (v_item.product_id, v_order.company_id, v_order.customer_id, 'purchase',
      jsonb_build_object('order_id', v_order.id, 'quantity', v_item.quantity, 'unit_price', v_item.unit_price));
    UPDATE public.products SET order_count = order_count + 1,
      revenue = revenue + (v_item.quantity * v_item.unit_price) WHERE id = v_item.product_id;
    IF NOT EXISTS (SELECT 1 FROM public.product_events
      WHERE product_id = v_item.product_id AND customer_id = v_order.customer_id
        AND event_type = 'purchase' AND metadata->>'order_id' <> _order_id::text) THEN
      UPDATE public.products SET unique_customers = unique_customers + 1 WHERE id = v_item.product_id;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_order(_order_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ SELECT private.complete_order(_order_id, auth.uid()); $$;

-- delete_order_item
CREATE OR REPLACE FUNCTION private.delete_order_item(_item_id uuid, _caller uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_order_id uuid; v_company_id uuid; v_remaining int; v_new_total numeric(10,2); v_order_deleted boolean := false;
BEGIN
  SELECT oi.order_id, o.company_id INTO v_order_id, v_company_id
    FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id WHERE oi.id = _item_id;
  IF v_order_id IS NULL THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF _caller IS NULL OR NOT private.has_company_access(_caller, v_company_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  DELETE FROM public.order_items WHERE id = _item_id;
  SELECT count(*) INTO v_remaining FROM public.order_items WHERE order_id = v_order_id;
  IF v_remaining = 0 THEN
    DELETE FROM public.orders WHERE id = v_order_id; v_order_deleted := true;
  ELSE
    SELECT COALESCE(SUM(quantity * unit_price), 0) INTO v_new_total
      FROM public.order_items WHERE order_id = v_order_id;
    UPDATE public.orders SET total = v_new_total WHERE id = v_order_id;
  END IF;
  RETURN jsonb_build_object('deleted', v_order_deleted, 'remaining_items', v_remaining, 'new_total', COALESCE(v_new_total, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_order_item(_item_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ SELECT private.delete_order_item(_item_id, auth.uid()); $$;

-- Legacy auto_checkin (p_ overload) — move to private
CREATE OR REPLACE FUNCTION private.auto_checkin_legacy(
  p_company_id uuid, p_auth_user_id uuid, p_customer_name text,
  p_table_id text DEFAULT '', p_table_name text DEFAULT '', p_source text DEFAULT 'link'
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_customer_id uuid; v_last_checkin timestamptz;
  v_cooldown interval := interval '4 hours'; v_now timestamptz := now();
  v_dow text; v_table_id text; v_table_name text;
BEGIN
  v_table_id := nullif(p_table_id, ''); v_table_name := nullif(p_table_name, '');
  INSERT INTO public.b2c_customers (company_id, auth_user_id, name, whatsapp, total_visits)
  VALUES (p_company_id, p_auth_user_id, p_customer_name, '', 1)
  ON CONFLICT (company_id, auth_user_id) DO UPDATE
    SET name = EXCLUDED.name, last_visit_at = now(),
        total_visits = b2c_customers.total_visits + 1
  RETURNING id INTO v_customer_id;
  SELECT start_time INTO v_last_checkin FROM public.checkins
    WHERE company_id = p_company_id AND customer_id = v_customer_id
    ORDER BY start_time DESC LIMIT 1;
  IF v_last_checkin IS NOT NULL AND (v_now - v_last_checkin) < v_cooldown THEN RETURN false; END IF;
  v_dow := CASE EXTRACT(dow FROM v_now)
    WHEN 0 THEN 'Domingo' WHEN 1 THEN 'Segunda' WHEN 2 THEN 'Terca'
    WHEN 3 THEN 'Quarta' WHEN 4 THEN 'Quinta' WHEN 5 THEN 'Sexta'
    WHEN 6 THEN 'Sabado' ELSE '' END;
  INSERT INTO public.checkins (company_id, customer_id, customer_name, table_id, table_name,
    visit_context, people_count, origin, start_time, day_of_week)
  VALUES (p_company_id, v_customer_id, p_customer_name, v_table_id, v_table_name,
    'Sozinho', 1, p_source, v_now, v_dow);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_checkin(
  p_company_id uuid, p_auth_user_id uuid, p_customer_name text,
  p_table_id text DEFAULT '', p_table_name text DEFAULT '', p_source text DEFAULT 'link'
) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ SELECT private.auto_checkin_legacy(p_company_id, p_auth_user_id, p_customer_name, p_table_id, p_table_name, p_source); $$;

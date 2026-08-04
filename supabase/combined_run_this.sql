-- ============================================================
-- COMBINED: product_options + option_value_images
-- Rode este arquivo ÚNICO no Supabase SQL Editor.
-- Seguro reexecutar.
-- ============================================================

-- ============================================================
-- PARTE 1: TABELAS + RLS + INDEXES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  option_type text NOT NULL
    CHECK (option_type IN ('single', 'multiple', 'text', 'quantity', 'toggle')),
  required boolean NOT NULL DEFAULT false,
  min_select integer,
  max_select integer,
  price_adjust numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price_adjust >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_options_product
  ON public.product_options(product_id);

CREATE TABLE IF NOT EXISTS public.product_option_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id uuid NOT NULL REFERENCES public.product_options(id) ON DELETE CASCADE,
  label text NOT NULL,
  price_adjust numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price_adjust >= 0),
  available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_option_values_option
  ON public.product_option_values(option_id);

CREATE TABLE IF NOT EXISTS public.order_item_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  option_id uuid REFERENCES public.product_options(id) ON DELETE SET NULL,
  option_name text NOT NULL,
  value_id uuid REFERENCES public.product_option_values(id) ON DELETE SET NULL,
  value_label text NOT NULL DEFAULT '',
  price_adjust numeric(10, 2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  free_text text,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_order_item_options_item
  ON public.order_item_options(order_item_id);

ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members manage product_options" ON public.product_options;
CREATE POLICY "Company members manage product_options"
  ON public.product_options
  FOR ALL TO authenticated
  USING (private.has_company_access(auth.uid(), (SELECT company_id FROM products WHERE id = product_id)))
  WITH CHECK (private.has_company_access(auth.uid(), (SELECT company_id FROM products WHERE id = product_id)));

DROP POLICY IF EXISTS "Anyone can read product_options" ON public.product_options;
CREATE POLICY "Anyone can read product_options"
  ON public.product_options
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Company members manage product_option_values" ON public.product_option_values;
CREATE POLICY "Company members manage product_option_values"
  ON public.product_option_values
  FOR ALL TO authenticated
  USING (private.has_company_access(auth.uid(), (SELECT company_id FROM products WHERE id = (SELECT product_id FROM product_options WHERE id = option_id))))
  WITH CHECK (private.has_company_access(auth.uid(), (SELECT company_id FROM products WHERE id = (SELECT product_id FROM product_options WHERE id = option_id))));

DROP POLICY IF EXISTS "Anyone can read product_option_values" ON public.product_option_values;
CREATE POLICY "Anyone can read product_option_values"
  ON public.product_option_values
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Company members read order_item_options" ON public.order_item_options;
CREATE POLICY "Company members read order_item_options"
  ON public.order_item_options
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.id = order_item_options.order_item_id
      AND private.has_company_access(auth.uid(), o.company_id)
  ));

DROP POLICY IF EXISTS "Order item options write via definer" ON public.order_item_options;
CREATE POLICY "Order item options write via definer"
  ON public.order_item_options
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.id = order_item_options.order_item_id
  ));

-- ============================================================
-- PARTE 2: get_product_public (com imageUrl nos valores)
-- ============================================================

DROP FUNCTION IF EXISTS public.get_product_public(text);
DROP FUNCTION IF EXISTS private.get_product_public(text);

CREATE OR REPLACE FUNCTION private.get_product_public(_slug text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', p.id, 'company_id', p.company_id, 'company_slug', c.slug,
    'name', p.name, 'slug', p.slug, 'category', p.category, 'price', p.price,
    'image_url', p.image_url, 'video_url', p.video_url,
    'available', p.available, 'description', p.description,
    'status', p.status, 'stock_quantity', p.stock_quantity, 'sku', p.sku,
    'internal_code', p.internal_code, 'views_count', p.views_count,
    'scan_count', p.scan_count, 'cart_additions_count', p.cart_additions_count,
    'order_count', p.order_count, 'revenue', p.revenue, 'unique_customers', p.unique_customers,
    'media', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object('id', pm.id, 'mediaType', pm.media_type, 'mediaUrl', pm.media_url, 'sortOrder', pm.sort_order)
        ORDER BY pm.sort_order, pm.created_at
      ) FROM product_media pm WHERE pm.product_id = p.id),
      '[]'::jsonb
    ),
    'options', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', po.id, 'name', po.name, 'optionType', po.option_type,
          'required', po.required, 'minSelect', po.min_select, 'maxSelect', po.max_select,
          'priceAdjust', po.price_adjust, 'sortOrder', po.sort_order,
          'values', COALESCE(
            (SELECT jsonb_agg(
              jsonb_build_object(
                'id', pv.id, 'label', pv.label, 'priceAdjust', pv.price_adjust,
                'available', pv.available, 'sortOrder', pv.sort_order,
                'imageUrl', pv.image_url)
              ORDER BY pv.sort_order, pv.created_at)
            FROM product_option_values pv WHERE pv.option_id = po.id),
            '[]'::jsonb
          )
        )
        ORDER BY po.sort_order, po.created_at
      ) FROM product_options po WHERE po.product_id = p.id),
      '[]'::jsonb
    )
  ) INTO v_result
  FROM products p JOIN companies c ON c.id = p.company_id
  WHERE p.slug = _slug AND p.status = 'active';
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_product_public(_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.get_product_public(_slug); $$;

REVOKE ALL ON FUNCTION public.get_product_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_public(text) TO anon, authenticated;

-- ============================================================
-- PARTE 3: create_customer_order (com opções por item)
-- ============================================================

DROP FUNCTION IF EXISTS public.create_customer_order(uuid, uuid, uuid, text, json, uuid, text, text, text);
DROP FUNCTION IF EXISTS private.create_customer_order(uuid, uuid, uuid, text, json, uuid, text, text, text);

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
  it json;
  v_opt json;
  v_product_id uuid;
  v_qty int;
  v_base numeric;
  v_unit numeric;
  v_item_id uuid;
  v_note text;
  v_opt_idx int;
  v_opt_id uuid;
  v_name text;
  v_type text;
  v_opt_price numeric;
  v_required boolean;
  v_min int;
  v_max int;
  v_val_id uuid;
  v_val_label text;
  v_free_text text;
  v_opt_qty int;
  v_count int;
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
    NULLIF(btrim(COALESCE(_note,'')), ''), 0, 0, 0, v_status,
    _payment_method, _payment_provider, 'pending')
  RETURNING id INTO v_order_id;

  FOR it IN SELECT * FROM json_array_elements(_items) LOOP
    v_product_id := (it->>'productId')::uuid;
    v_qty := (it->>'quantity')::int;
    v_note := NULLIF(btrim(COALESCE(it->>'note','')), '');
    IF v_qty IS NULL OR v_qty < 1 THEN RAISE EXCEPTION 'invalid quantity'; END IF;

    SELECT price INTO v_base FROM products WHERE id=v_product_id AND company_id=_company_id;
    IF v_base IS NULL THEN RAISE EXCEPTION 'invalid product'; END IF;

    FOR v_opt IN SELECT * FROM json_array_elements(COALESCE(it->'options', '[]'::json)) LOOP
      v_opt_id := (v_opt->>'optionId')::uuid;
      SELECT option_type, required, min_select, max_select
        INTO v_type, v_required, v_min, v_max
        FROM product_options WHERE id=v_opt_id AND product_id=v_product_id;
      IF v_type IS NULL THEN RAISE EXCEPTION 'invalid option'; END IF;

      IF v_type IN ('single', 'multiple') THEN
        SELECT count(*) INTO v_count
        FROM json_array_elements(COALESCE(it->'options', '[]'::json)) o2
        WHERE (o2->>'optionId')::uuid = v_opt_id AND (o2->>'valueId') IS NOT NULL;
        IF v_type = 'single' THEN
          IF v_count > 1 THEN RAISE EXCEPTION 'single option has multiple values'; END IF;
          IF v_required AND v_count = 0 THEN RAISE EXCEPTION 'required option not selected'; END IF;
        ELSE
          IF v_min IS NOT NULL AND v_count < v_min THEN RAISE EXCEPTION 'minimum selections not met'; END IF;
          IF v_max IS NOT NULL AND v_count > v_max THEN RAISE EXCEPTION 'maximum selections exceeded'; END IF;
          IF v_required AND v_count = 0 THEN RAISE EXCEPTION 'required option not selected'; END IF;
        END IF;
      ELSIF v_type = 'text' AND v_required THEN
        IF NULLIF(btrim(COALESCE(v_opt->>'freeText','')), '') IS NULL THEN
          RAISE EXCEPTION 'required text missing';
        END IF;
      END IF;
    END LOOP;

    v_unit := v_base;
    FOR v_opt IN SELECT * FROM json_array_elements(COALESCE(it->'options', '[]'::json)) LOOP
      v_opt_id := (v_opt->>'optionId')::uuid;
      SELECT option_type, price_adjust, max_select INTO v_type, v_opt_price, v_max
        FROM product_options WHERE id=v_opt_id AND product_id=v_product_id;
      IF v_type IS NULL THEN CONTINUE; END IF;

      IF v_type IN ('single', 'multiple') THEN
        SELECT price_adjust INTO v_opt_price
          FROM product_option_values
          WHERE id=(v_opt->>'valueId')::uuid AND option_id=v_opt_id AND available;
        IF v_opt_price IS NOT NULL THEN v_unit := v_unit + v_opt_price; END IF;
      ELSIF v_type = 'quantity' THEN
        v_opt_qty := COALESCE((v_opt->>'quantity')::int, 0);
        IF v_opt_qty >= 1 THEN v_unit := v_unit + COALESCE(v_opt_price, 0) * v_opt_qty; END IF;
      ELSIF v_type = 'toggle' THEN
        v_opt_qty := COALESCE((v_opt->>'quantity')::int, 0);
        IF v_opt_qty >= 1 THEN v_unit := v_unit + COALESCE(v_opt_price, 0); END IF;
      END IF;
    END LOOP;

    INSERT INTO order_items (order_id, product_id, quantity, unit_price, note)
    VALUES (v_order_id, v_product_id, v_qty, v_unit, v_note)
    RETURNING id INTO v_item_id;
    v_total := v_total + v_unit * v_qty;

    v_opt_idx := 0;
    FOR v_opt IN SELECT * FROM json_array_elements(COALESCE(it->'options', '[]'::json)) LOOP
      v_opt_idx := v_opt_idx + 1;
      v_opt_id := (v_opt->>'optionId')::uuid;
      v_opt_qty := COALESCE((v_opt->>'quantity')::int, 1);
      v_free_text := NULLIF(btrim(COALESCE(v_opt->>'freeText','')), '');

      SELECT name, option_type, price_adjust INTO v_name, v_type, v_opt_price
        FROM product_options WHERE id=v_opt_id AND product_id=v_product_id;
      IF v_name IS NULL THEN CONTINUE; END IF;

      v_val_id := NULL;
      v_val_label := NULL;

      IF v_type IN ('single', 'multiple') THEN
        v_val_id := (v_opt->>'valueId')::uuid;
        SELECT label, price_adjust INTO v_val_label, v_opt_price
          FROM product_option_values WHERE id=v_val_id AND option_id=v_opt_id AND available;
        IF v_val_label IS NULL THEN CONTINUE; END IF;
        v_opt_qty := 1;
      ELSIF v_type = 'text' THEN
        IF v_free_text IS NULL THEN CONTINUE; END IF;
        v_opt_price := 0;
        v_opt_qty := 1;
      ELSIF v_type = 'quantity' THEN
        IF v_opt_qty < 1 THEN CONTINUE; END IF;
        v_opt_qty := LEAST(v_opt_qty, COALESCE(v_max, v_opt_qty));
      ELSIF v_type = 'toggle' THEN
        IF v_opt_qty < 1 THEN CONTINUE; END IF;
        v_opt_qty := 1;
      END IF;

      INSERT INTO order_item_options (
        order_item_id, option_id, option_name, value_id, value_label,
        price_adjust, quantity, free_text, sort_order)
      VALUES (
        v_item_id, v_opt_id, v_name, v_val_id, COALESCE(v_val_label, ''),
        COALESCE(v_opt_price, 0), v_opt_qty, v_free_text, v_opt_idx);
    END LOOP;
  END LOOP;

  UPDATE orders SET subtotal = v_total, total = v_total WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_customer_order(
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
LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
  SELECT private.create_customer_order(_customer_id, _token, _company_id, _note, _items, _table_id, _payment_method, _payment_provider, _session_id);
$$;

REVOKE ALL ON FUNCTION public.create_customer_order(uuid, uuid, uuid, text, json, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_order(uuid, uuid, uuid, text, json, uuid, text, text, text) TO anon, authenticated;

-- ============================================================
-- PARTE 4: list_customer_orders (com opções congeladas)
-- ============================================================

DROP FUNCTION IF EXISTS public.list_customer_orders(uuid, uuid);
DROP FUNCTION IF EXISTS private.list_customer_orders(uuid, uuid);

CREATE OR REPLACE FUNCTION private.list_customer_orders(_customer_id uuid, _token uuid)
RETURNS SETOF json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY
  SELECT to_json(x) FROM (
    SELECT o.id, o.company_id, o.merchant_id, o.customer_id, o.customer_session_id,
           o.table_id, o.status, o.payment_status, o.payment_provider, o.payment_id,
           o.subtotal, o.discount, o.total, o.note, o.payment_method, o.created_at,
      json_build_object('label', t.label) AS "table",
      COALESCE((
        SELECT json_agg(json_build_object(
          'id',oi.id,'order_id',oi.order_id,'product_id',oi.product_id,
          'quantity',oi.quantity,'unit_price',oi.unit_price,'total',oi.total,'note',oi.note,
          'product', json_build_object('name', pr.name),
          'order_item_options', COALESCE((
            SELECT json_agg(json_build_object(
              'id', oio.id, 'option_name', oio.option_name,
              'value_label', oio.value_label, 'price_adjust', oio.price_adjust,
              'quantity', oio.quantity, 'free_text', oio.free_text)
            ORDER BY oio.sort_order)
            FROM order_item_options oio WHERE oio.order_item_id = oi.id),
            '[]'::json)))
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

-- ============================================================
-- PARTE 5: list_public_posts (com has_options)
-- ============================================================

CREATE OR REPLACE FUNCTION private.list_public_posts(_company_id uuid, _viewer_customer_id uuid DEFAULT NULL)
RETURNS SETOF json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT to_json(p) FROM (
    SELECT
      po.id, po.company_id, po.author_type, po.customer_id,
      c.name AS customer_name,
      c.avatar_url AS customer_avatar_url,
      co.logo_url AS company_logo_url,
      po.image_url, po.video_url, po.text, po.category, po.companions, po.created_at,
      (SELECT count(*)::int FROM post_reactions r WHERE r.post_id=po.id AND r.type='love') AS love_count,
      (SELECT count(*)::int FROM post_reactions r WHERE r.post_id=po.id AND r.type='dislike') AS dislike_count,
      (SELECT count(*)::int FROM comments cm WHERE cm.post_id=po.id) AS comment_count,
      (SELECT r.type::text FROM post_reactions r WHERE r.post_id=po.id AND r.customer_id=_viewer_customer_id LIMIT 1) AS my_reaction,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id',pr.id,'company_id',pr.company_id,'name',pr.name,'category',pr.category,
          'price',pr.price,'image_url',pr.image_url,'available',pr.available,'description',pr.description,
          'slug',pr.slug,
          'has_options', EXISTS(SELECT 1 FROM product_options po2 WHERE po2.product_id=pr.id)))
        FROM post_products pp JOIN products pr ON pr.id=pp.product_id
        WHERE pp.post_id=po.id
      ), '[]'::json) AS products
    FROM posts po
    LEFT JOIN customers c ON c.id=po.customer_id
    LEFT JOIN companies co ON co.id=po.company_id
    WHERE po.company_id=_company_id
    ORDER BY po.created_at DESC
    LIMIT 50
  ) p;
$$;

-- ============================================================
-- PARTE 6: STORAGE — upload para option-values/
-- ============================================================

DROP POLICY IF EXISTS "Authenticated upload option-values" ON storage.objects;
CREATE POLICY "Authenticated upload option-values"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'weaze-media'
  AND (storage.foldername(name))[1] = 'option-values'
);

-- ============================================================
-- PARTE 7: STORAGE — leitura pública (com option-values)
-- ============================================================

DROP POLICY IF EXISTS "Public read weaze-media referenced" ON storage.objects;

CREATE POLICY "Public read weaze-media referenced"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'weaze-media'
  AND (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.logo_url LIKE '%/weaze-media/' || objects.name
    )
    OR EXISTS (
      SELECT 1 FROM products p
      WHERE p.available = true
        AND COALESCE(p.status, 'active') = 'active'
        AND (
          p.image_url LIKE '%/weaze-media/' || objects.name
          OR p.video_url LIKE '%/weaze-media/' || objects.name
        )
    )
    OR EXISTS (
      SELECT 1 FROM product_media pm
      JOIN products p ON p.id = pm.product_id
      WHERE p.available = true
        AND COALESCE(p.status, 'active') = 'active'
        AND pm.media_url LIKE '%/weaze-media/' || objects.name
    )
    OR EXISTS (
      SELECT 1 FROM posts po
      WHERE po.image_url LIKE '%/weaze-media/' || objects.name
         OR po.video_url LIKE '%/weaze-media/' || objects.name
    )
    OR EXISTS (
      SELECT 1 FROM product_option_values pov
      WHERE pov.image_url LIKE '%/weaze-media/' || objects.name
    )
  )
);

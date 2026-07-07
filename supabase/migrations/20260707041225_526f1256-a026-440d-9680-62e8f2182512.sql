
-- ============================================================
-- 1. Drop overly permissive anon SELECT policies
-- ============================================================
DROP POLICY IF EXISTS "Anon can read checkins" ON public.checkins;
DROP POLICY IF EXISTS "Public read customer profile" ON public.customers;
DROP POLICY IF EXISTS "Orders readable by anon" ON public.orders;
DROP POLICY IF EXISTS "Order items readable by anon" ON public.order_items;

-- Revoke column grants no longer needed (public reads now go through RPCs)
REVOKE SELECT (id, company_id, name, avatar_url) ON public.customers FROM anon;

-- ============================================================
-- 2. Ensure private schema and move DEFINER logic there
-- ============================================================
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO postgres, service_role;
-- NOTE: private schema is NOT exposed to PostgREST and NOT granted to anon/authenticated

-- Drop old public DEFINER functions (will be recreated as INVOKER wrappers below)
DROP FUNCTION IF EXISTS public.upsert_customer_visit(uuid, text, text);
DROP FUNCTION IF EXISTS public.get_customer_self(uuid, uuid);
DROP FUNCTION IF EXISTS public.update_customer_self(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.set_post_reaction(uuid, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.toggle_product_like(uuid, uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.toggle_product_wish(uuid, uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.claim_own_company(text, text);

-- ------------------ private implementations ------------------
CREATE OR REPLACE FUNCTION private.upsert_customer_visit(_company_id uuid, _name text, _whatsapp text)
RETURNS TABLE(customer_id uuid, session_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_token uuid;
BEGIN
  IF _name IS NULL OR length(btrim(_name)) = 0 THEN RAISE EXCEPTION 'name required'; END IF;
  IF _whatsapp IS NULL OR length(btrim(_whatsapp)) = 0 THEN RAISE EXCEPTION 'whatsapp required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id) THEN
    RAISE EXCEPTION 'invalid company';
  END IF;
  SELECT c.id, c.session_token INTO v_id, v_token
    FROM public.customers c
    WHERE c.company_id = _company_id AND c.whatsapp = _whatsapp;
  IF v_id IS NULL THEN
    INSERT INTO public.customers (company_id, name, whatsapp)
    VALUES (_company_id, _name, _whatsapp)
    RETURNING id, public.customers.session_token INTO v_id, v_token;
  ELSE
    UPDATE public.customers
      SET name = _name,
          last_visit_at = now(),
          visit_count = COALESCE(visit_count, 0) + 1
      WHERE id = v_id;
  END IF;
  RETURN QUERY SELECT v_id, v_token;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_customer_self(_customer_id uuid, _token uuid)
RETURNS SETOF public.customers
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY SELECT * FROM public.customers WHERE id = _customer_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.update_customer_self(_customer_id uuid, _token uuid, _name text, _whatsapp text, _avatar_url text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public.customers
    SET name = COALESCE(_name, name),
        whatsapp = COALESCE(_whatsapp, whatsapp),
        avatar_url = _avatar_url
    WHERE id = _customer_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.set_post_reaction(_customer_id uuid, _token uuid, _post_id uuid, _type text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _type IS NULL THEN
    DELETE FROM public.post_reactions WHERE post_id = _post_id AND customer_id = _customer_id;
    RETURN;
  END IF;
  IF _type NOT IN ('love','dislike') THEN RAISE EXCEPTION 'invalid type'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.posts p JOIN public.customers c ON c.id = _customer_id
    WHERE p.id = _post_id AND c.company_id = p.company_id
  ) THEN RAISE EXCEPTION 'company mismatch'; END IF;
  INSERT INTO public.post_reactions (post_id, customer_id, type)
    VALUES (_post_id, _customer_id, _type::reaction_type)
    ON CONFLICT (post_id, customer_id) DO UPDATE SET type = EXCLUDED.type;
END;
$$;

CREATE OR REPLACE FUNCTION private.toggle_product_like(_customer_id uuid, _token uuid, _product_id uuid, _liked boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _liked THEN
    DELETE FROM public.product_likes WHERE product_id = _product_id AND customer_id = _customer_id;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.products p JOIN public.customers c ON c.id = _customer_id
      WHERE p.id = _product_id AND c.company_id = p.company_id
    ) THEN RAISE EXCEPTION 'company mismatch'; END IF;
    INSERT INTO public.product_likes (product_id, customer_id)
      VALUES (_product_id, _customer_id) ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.toggle_product_wish(_customer_id uuid, _token uuid, _product_id uuid, _wished boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _wished THEN
    DELETE FROM public.product_wishes WHERE product_id = _product_id AND customer_id = _customer_id;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.products p JOIN public.customers c ON c.id = _customer_id
      WHERE p.id = _product_id AND c.company_id = p.company_id
    ) THEN RAISE EXCEPTION 'company mismatch'; END IF;
    INSERT INTO public.product_wishes (product_id, customer_id)
      VALUES (_product_id, _customer_id) ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- ------------------ new private RPCs ------------------
CREATE OR REPLACE FUNCTION private.list_public_posts(_company_id uuid, _viewer_customer_id uuid DEFAULT NULL)
RETURNS SETOF json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT to_json(p) FROM (
    SELECT
      po.id, po.company_id, po.author_type, po.customer_id,
      c.name AS customer_name,
      po.image_url, po.video_url, po.text, po.category, po.companions, po.created_at,
      (SELECT count(*)::int FROM post_reactions r WHERE r.post_id=po.id AND r.type='love') AS love_count,
      (SELECT count(*)::int FROM post_reactions r WHERE r.post_id=po.id AND r.type='dislike') AS dislike_count,
      (SELECT count(*)::int FROM comments cm WHERE cm.post_id=po.id) AS comment_count,
      (SELECT r.type::text FROM post_reactions r WHERE r.post_id=po.id AND r.customer_id=_viewer_customer_id LIMIT 1) AS my_reaction,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id',pr.id,'company_id',pr.company_id,'name',pr.name,'category',pr.category,
          'price',pr.price,'image_url',pr.image_url,'available',pr.available,'description',pr.description))
        FROM post_products pp JOIN products pr ON pr.id=pp.product_id
        WHERE pp.post_id=po.id
      ), '[]'::json) AS products
    FROM posts po
    LEFT JOIN customers c ON c.id=po.customer_id
    WHERE po.company_id=_company_id
    ORDER BY po.created_at DESC
    LIMIT 50
  ) p;
$$;

CREATE OR REPLACE FUNCTION private.list_public_comments(_post_id uuid)
RETURNS SETOF json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT to_json(x) FROM (
    SELECT cm.id, cm.post_id, cm.customer_id,
           COALESCE(c.name, 'Cliente') AS customer_name,
           cm.text, cm.image_url, cm.created_at
    FROM comments cm LEFT JOIN customers c ON c.id=cm.customer_id
    WHERE cm.post_id=_post_id
    ORDER BY cm.created_at ASC
  ) x;
$$;

CREATE OR REPLACE FUNCTION private.list_customer_orders(_customer_id uuid, _token uuid)
RETURNS SETOF json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY
  SELECT to_json(x) FROM (
    SELECT o.id, o.company_id, o.customer_id, o.table_id, o.status, o.total, o.note, o.created_at,
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

  INSERT INTO orders (company_id, customer_id, table_id, note, total, status)
    VALUES (_company_id, _customer_id, v_table, NULLIF(btrim(COALESCE(_note,'')), ''), v_total, 'received')
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

CREATE OR REPLACE FUNCTION private.create_checkin(
  _customer_id uuid, _token uuid, _company_id uuid, _context text,
  _table_id uuid DEFAULT NULL, _source text DEFAULT 'qr')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id=_customer_id AND company_id=_company_id) THEN
    RAISE EXCEPTION 'company mismatch';
  END IF;
  INSERT INTO checkins (customer_id, company_id, table_id, context, source)
    VALUES (_customer_id, _company_id, _table_id, _context::visit_context, COALESCE(_source, 'qr'))
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ============================================================
-- 3. Public INVOKER wrappers (thin, no logic, callable from PostgREST)
-- ============================================================
CREATE OR REPLACE FUNCTION public.upsert_customer_visit(_company_id uuid, _name text, _whatsapp text)
RETURNS TABLE(customer_id uuid, session_token uuid)
LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
  SELECT * FROM private.upsert_customer_visit(_company_id, _name, _whatsapp);
$$;

CREATE OR REPLACE FUNCTION public.get_customer_self(_customer_id uuid, _token uuid)
RETURNS SETOF public.customers
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT * FROM private.get_customer_self(_customer_id, _token);
$$;

CREATE OR REPLACE FUNCTION public.update_customer_self(_customer_id uuid, _token uuid, _name text, _whatsapp text, _avatar_url text)
RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
  SELECT private.update_customer_self(_customer_id, _token, _name, _whatsapp, _avatar_url);
$$;

CREATE OR REPLACE FUNCTION public.set_post_reaction(_customer_id uuid, _token uuid, _post_id uuid, _type text)
RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
  SELECT private.set_post_reaction(_customer_id, _token, _post_id, _type);
$$;

CREATE OR REPLACE FUNCTION public.toggle_product_like(_customer_id uuid, _token uuid, _product_id uuid, _liked boolean)
RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
  SELECT private.toggle_product_like(_customer_id, _token, _product_id, _liked);
$$;

CREATE OR REPLACE FUNCTION public.toggle_product_wish(_customer_id uuid, _token uuid, _product_id uuid, _wished boolean)
RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
  SELECT private.toggle_product_wish(_customer_id, _token, _product_id, _wished);
$$;

CREATE OR REPLACE FUNCTION public.list_public_posts(_company_id uuid, _viewer_customer_id uuid DEFAULT NULL)
RETURNS SETOF json
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT * FROM private.list_public_posts(_company_id, _viewer_customer_id);
$$;

CREATE OR REPLACE FUNCTION public.list_public_comments(_post_id uuid)
RETURNS SETOF json
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT * FROM private.list_public_comments(_post_id);
$$;

CREATE OR REPLACE FUNCTION public.list_customer_orders(_customer_id uuid, _token uuid)
RETURNS SETOF json
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT * FROM private.list_customer_orders(_customer_id, _token);
$$;

CREATE OR REPLACE FUNCTION public.create_customer_order(
  _customer_id uuid, _token uuid, _company_id uuid, _note text, _items json, _table_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
  SELECT private.create_customer_order(_customer_id, _token, _company_id, _note, _items, _table_id);
$$;

CREATE OR REPLACE FUNCTION public.create_checkin(
  _customer_id uuid, _token uuid, _company_id uuid, _context text,
  _table_id uuid DEFAULT NULL, _source text DEFAULT 'qr')
RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
  SELECT private.create_checkin(_customer_id, _token, _company_id, _context, _table_id, _source);
$$;

-- claim_own_company: authenticated only, INVOKER wrapper
CREATE OR REPLACE FUNCTION public.claim_own_company(_name text, _slug text)
RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
  SELECT private.claim_own_company(_name, _slug);
$$;

-- ============================================================
-- 4. Execute grants
-- ============================================================
REVOKE ALL ON FUNCTION public.upsert_customer_visit(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_customer_visit(uuid,text,text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_customer_self(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_self(uuid,uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.update_customer_self(uuid,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_customer_self(uuid,uuid,text,text,text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.set_post_reaction(uuid,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_post_reaction(uuid,uuid,uuid,text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.toggle_product_like(uuid,uuid,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_product_like(uuid,uuid,uuid,boolean) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.toggle_product_wish(uuid,uuid,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_product_wish(uuid,uuid,uuid,boolean) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.list_public_posts(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_posts(uuid,uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.list_public_comments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_comments(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.list_customer_orders(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_customer_orders(uuid,uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.create_customer_order(uuid,uuid,uuid,text,json,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_order(uuid,uuid,uuid,text,json,uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.create_checkin(uuid,uuid,uuid,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_checkin(uuid,uuid,uuid,text,uuid,text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.claim_own_company(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_own_company(text,text) TO authenticated;

-- ============================================================
-- 5. Storage: tighten anon comment uploads and add staff cleanup
-- ============================================================
DROP POLICY IF EXISTS "Anon can upload comment photos" ON storage.objects;
CREATE POLICY "Anon can upload comment photos"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'weaze-media'
  AND (storage.foldername(name))[1] = 'comments'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id::text = (storage.foldername(name))[2]
  )
);

DROP POLICY IF EXISTS "Company staff manage comment photos" ON storage.objects;
CREATE POLICY "Company staff manage comment photos"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'weaze-media'
  AND (storage.foldername(name))[1] = 'comments'
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id::text = (storage.foldername(name))[2]
      AND private.has_company_access(auth.uid(), c.company_id)
  )
)
WITH CHECK (
  bucket_id = 'weaze-media'
  AND (storage.foldername(name))[1] = 'comments'
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id::text = (storage.foldername(name))[2]
      AND private.has_company_access(auth.uid(), c.company_id)
  )
);

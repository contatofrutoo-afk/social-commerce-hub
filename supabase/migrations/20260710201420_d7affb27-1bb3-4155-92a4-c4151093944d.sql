
-- 1) b2c_customers: enable RLS (no policies -> locked; SECURITY DEFINER auto_checkin still works)
ALTER TABLE public.b2c_customers ENABLE ROW LEVEL SECURITY;

-- Company staff can read/manage their own b2c customers
CREATE POLICY "Company staff read b2c_customers"
  ON public.b2c_customers FOR SELECT TO authenticated
  USING (private.has_company_access(auth.uid(), company_id));

CREATE POLICY "Company staff manage b2c_customers"
  ON public.b2c_customers FOR ALL TO authenticated
  USING (private.has_company_access(auth.uid(), company_id))
  WITH CHECK (private.has_company_access(auth.uid(), company_id));

-- 2) companies: drop public read policy; public reads go through get_company_public()
DROP POLICY IF EXISTS "Companies are readable by everyone" ON public.companies;

-- Ensure company members can SELECT their own company row (needed for admin views)
DROP POLICY IF EXISTS "Company members read companies" ON public.companies;
CREATE POLICY "Company members read companies"
  ON public.companies FOR SELECT TO authenticated
  USING (
    private.has_company_access(auth.uid(), id)
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role::text = 'admin'
    )
  );

REVOKE SELECT ON public.companies FROM anon;

-- 3) product_events: drop overly-permissive insert policy (WITH CHECK true)
DROP POLICY IF EXISTS "Anyone can insert product_events" ON public.product_events;
-- Inserts must go through public.record_product_event (SECURITY DEFINER)

-- 4) tables: drop fully-public read policy; anon accesses via new SECURITY DEFINER
DROP POLICY IF EXISTS "Tables readable by everyone" ON public.tables;
REVOKE SELECT ON public.tables FROM anon;

CREATE OR REPLACE FUNCTION public.get_table_public(_company_id uuid, _slug text)
RETURNS TABLE(id uuid, company_id uuid, label text, slug text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.company_id, t.label, t.slug
  FROM public.tables t
  WHERE t.company_id = _company_id AND t.slug = _slug
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_table_public(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_table_public(uuid, text) TO anon, authenticated;

-- 5) customers.session_token: prevent staff SELECT of the token column
REVOKE SELECT ON public.customers FROM authenticated;
GRANT SELECT (id, company_id, name, whatsapp, avatar_url, first_visit_at, last_visit_at, visit_count, created_at)
  ON public.customers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.customers TO authenticated;

-- 6) storage: replace weak "owner = auth.uid()" with company-folder scoped policy
DROP POLICY IF EXISTS "Authenticated manage own" ON storage.objects;

CREATE POLICY "Authenticated manage company files"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'weaze-media'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM public.user_roles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'weaze-media'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

-- 7) SECURITY DEFINER functions: tighten EXECUTE grants
-- Admin/staff-only functions: revoke anon
REVOKE EXECUTE ON FUNCTION public.complete_order(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_order_item(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_order_item(uuid) TO authenticated;

-- has_role is only needed by RLS (runs with definer/owner privileges) — lock down entirely
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, PUBLIC;

-- Add caller authorization inside admin functions as defense-in-depth
CREATE OR REPLACE FUNCTION public.complete_order(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
  v_item record;
BEGIN
  SELECT id, company_id, customer_id, status
    INTO v_order FROM public.orders WHERE id = _order_id;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF auth.uid() IS NULL OR NOT private.has_company_access(auth.uid(), v_order.company_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_order.status = 'completed' THEN RETURN; END IF;

  UPDATE public.orders SET status = 'completed' WHERE id = _order_id;

  FOR v_item IN
    SELECT oi.product_id, oi.quantity, oi.unit_price
      FROM public.order_items oi WHERE oi.order_id = _order_id
  LOOP
    INSERT INTO public.product_events
      (product_id, company_id, customer_id, event_type, metadata)
    VALUES (
      v_item.product_id, v_order.company_id, v_order.customer_id,
      'purchase',
      jsonb_build_object('order_id', v_order.id, 'quantity', v_item.quantity, 'unit_price', v_item.unit_price)
    );

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
      UPDATE public.products
        SET unique_customers = unique_customers + 1
        WHERE id = v_item.product_id;
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_order_item(_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_company_id uuid;
  v_remaining int;
  v_new_total numeric(10,2);
  v_order_deleted boolean := false;
BEGIN
  SELECT oi.order_id, o.company_id INTO v_order_id, v_company_id
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.id = _item_id;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;

  IF auth.uid() IS NULL OR NOT private.has_company_access(auth.uid(), v_company_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  DELETE FROM public.order_items WHERE id = _item_id;

  SELECT count(*) INTO v_remaining
    FROM public.order_items WHERE order_id = v_order_id;

  IF v_remaining = 0 THEN
    DELETE FROM public.orders WHERE id = v_order_id;
    v_order_deleted := true;
  ELSE
    SELECT COALESCE(SUM(quantity * unit_price), 0)
      INTO v_new_total
      FROM public.order_items WHERE order_id = v_order_id;
    UPDATE public.orders SET total = v_new_total WHERE id = v_order_id;
  END IF;

  RETURN jsonb_build_object(
    'deleted', v_order_deleted,
    'remaining_items', v_remaining,
    'new_total', COALESCE(v_new_total, 0)
  );
END;
$function$;

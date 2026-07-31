-- Perfil de atendimento restrito a funcionários.
--
-- O painel público /c/:slug/vendas só deve expor snapshots mínimos
-- (mesas e presença) via RPCs SECURITY DEFINER. O perfil completo do
-- cliente (inclui whatsapp e histórico) não pode ser lido anonimamente —
-- o acesso anon às tabelas customers/product_likes/product_wishes foi
-- revogado por privacidade/LGPD. Esta RPC consolida a leitura e valida
-- que o chamador é staff com acesso à empresa do cliente.

CREATE OR REPLACE FUNCTION public.get_customer_service_profile(_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_result jsonb;
BEGIN
  SELECT company_id INTO v_company_id
    FROM public.customers
   WHERE id = _customer_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  IF auth.uid() IS NULL OR NOT private.has_company_access(auth.uid(), v_company_id) THEN
    RAISE EXCEPTION 'Acesso restrito: faça login como funcionário do estabelecimento';
  END IF;

  SELECT jsonb_build_object(
    'customer', (
      SELECT jsonb_build_object(
        'id', c.id,
        'company_id', c.company_id,
        'name', c.name,
        'whatsapp', c.whatsapp,
        'avatar_url', c.avatar_url,
        'first_visit_at', c.first_visit_at,
        'last_visit_at', c.last_visit_at,
        'visit_count', c.visit_count,
        'created_at', c.created_at
      )
      FROM public.customers c
      WHERE c.id = _customer_id
    ),
    'checkins', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT ch.id, ch.context, ch.created_at, ch.checked_out_at, ch.source, ch.table_id,
               jsonb_build_object('label', t.label) AS "table"
        FROM public.checkins ch
        LEFT JOIN public.tables t ON t.id = ch.table_id
        WHERE ch.customer_id = _customer_id
      ) x
    ),
    'orders', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT o.id, o.company_id, o.customer_id, o.table_id, o.status, o.total, o.note, o.created_at,
               jsonb_build_object('label', t.label) AS "table",
               (
                 SELECT COALESCE(jsonb_agg(y), '[]'::jsonb)
                 FROM (
                   SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.note, oi.unit_price,
                          jsonb_build_object('name', p.name, 'category', p.category) AS product
                   FROM public.order_items oi
                   LEFT JOIN public.products p ON p.id = oi.product_id
                   WHERE oi.order_id = o.id
                 ) y
               ) AS order_items
        FROM public.orders o
        LEFT JOIN public.tables t ON t.id = o.table_id
        WHERE o.customer_id = _customer_id
      ) x
    ),
    'likes', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT pl.product_id, pl.created_at,
               jsonb_build_object('name', p.name, 'category', p.category, 'image_url', p.image_url, 'price', p.price) AS product
        FROM public.product_likes pl
        LEFT JOIN public.products p ON p.id = pl.product_id
        WHERE pl.customer_id = _customer_id
      ) x
    ),
    'wishes', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
      FROM (
        SELECT w.product_id,
               jsonb_build_object('name', p.name, 'category', p.category, 'image_url', p.image_url, 'price', p.price) AS product
        FROM public.product_wishes w
        LEFT JOIN public.products p ON p.id = w.product_id
        WHERE w.customer_id = _customer_id
      ) x
    ),
    'events', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT pe.id, pe.event_type, pe.product_id, pe.created_at
        FROM public.product_events pe
        WHERE pe.customer_id = _customer_id
          AND pe.event_type IN ('cart_add', 'purchase')
      ) x
    ),
    'eventProducts', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name)), '[]'::jsonb)
      FROM public.products p
      WHERE p.id IN (
        SELECT DISTINCT pe.product_id
        FROM public.product_events pe
        WHERE pe.customer_id = _customer_id
          AND pe.event_type IN ('cart_add', 'purchase')
          AND pe.product_id IS NOT NULL
      )
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_service_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_service_profile(uuid) TO authenticated;

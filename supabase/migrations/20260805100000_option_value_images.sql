-- ============================================================
-- OPÇÕES DO PRODUTO — IMAGENS NOS VALORES
--
-- 1. Adiciona image_url em product_option_values
-- 2. Atualiza get_product_public para retornar imageUrl
-- 3. Permite upload autenticado na pasta option-values/
-- 4. Permite leitura pública de imagens referenciadas em product_option_values
--
-- Seguro reexecutar.
-- ============================================================

-- 1. Coluna image_url
ALTER TABLE public.product_option_values
  ADD COLUMN IF NOT EXISTS image_url text;

-- 2. get_product_public com imageUrl
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

-- 3. Upload autenticado na pasta option-values/
DROP POLICY IF EXISTS "Authenticated upload option-values" ON storage.objects;
CREATE POLICY "Authenticated upload option-values"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'weaze-media'
  AND (storage.foldername(name))[1] = 'option-values'
);

-- 4. Leitura pública de imagens referenciadas em product_option_values
--    Substitui a política existente mantendo todas as condições anteriores
--    e adicionando apenas product_option_values.
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

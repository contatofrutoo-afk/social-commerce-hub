-- ============================================================
-- Mídias múltiplas por produto (fotos + vídeos)
-- Até 4 mídias por produto
-- ============================================================

-- 1. Tabela de mídias do produto
CREATE TABLE IF NOT EXISTS public.product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_media_product ON public.product_media(product_id);

-- RLS
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members manage product_media" ON public.product_media;
CREATE POLICY "Company members manage product_media"
  ON public.product_media
  FOR ALL TO authenticated
  USING (private.has_company_access(auth.uid(), (SELECT company_id FROM products WHERE id = product_id)))
  WITH CHECK (private.has_company_access(auth.uid(), (SELECT company_id FROM products WHERE id = product_id)));

DROP POLICY IF EXISTS "Anyone can read product_media" ON public.product_media;
CREATE POLICY "Anyone can read product_media"
  ON public.product_media
  FOR SELECT TO anon, authenticated
  USING (true);

-- 2. Atualizar a função get_product_public para incluir as mídias
DROP FUNCTION IF EXISTS public.get_product_public(text);

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

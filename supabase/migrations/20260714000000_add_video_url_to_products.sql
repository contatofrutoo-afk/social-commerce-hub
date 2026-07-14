ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url text;

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
    'order_count', p.order_count, 'revenue', p.revenue, 'unique_customers', p.unique_customers
  ) INTO v_result
  FROM products p JOIN companies c ON c.id = p.company_id
  WHERE p.slug = _slug AND p.status = 'active' AND c.status = 'active';
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_product_public(_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.get_product_public(_slug); $$;

REVOKE ALL ON FUNCTION public.get_product_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_public(text) TO anon, authenticated;

ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url text;

DROP FUNCTION IF EXISTS get_product_public(text);

CREATE FUNCTION get_product_public(_slug text)
RETURNS SETOF products
LANGUAGE sql
STABLE
AS $$
  SELECT p.*
  FROM products p
  JOIN companies c ON c.id = p.company_id
  WHERE p.slug = _slug
    AND p.status = 'active'
    AND c.status = 'active'
$$;

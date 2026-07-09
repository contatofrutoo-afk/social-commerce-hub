
-- 1) Companies: drop broad public SELECT, expose safe branding via RPC
DROP POLICY IF EXISTS "Companies are readable by everyone" ON public.companies;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.companies FROM anon;

CREATE OR REPLACE FUNCTION public.get_company_public(_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  logo_url text,
  primary_color text,
  welcome_message text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.slug, c.logo_url, c.primary_color, c.welcome_message
  FROM public.companies c
  WHERE c.slug = _slug
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_company_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_company_public(text) TO anon, authenticated;

-- 2) Customers: no anon direct table access (RPCs handle self-access via session token)
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.customers FROM anon;

-- 3) Storage: drop typo policy, add correct scoped SELECT for weaze-media
DROP POLICY IF EXISTS "Public read weaze-media public folders" ON storage.objects;
CREATE POLICY "Public read weaze-media public folders"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'weaze-media'
  AND (storage.foldername(name))[1] = ANY (ARRAY['logos','business','posts','products','feed','publicar','comments','avatars','general'])
);

-- 4) SECURITY DEFINER functions: tighten EXECUTE grants
-- has_role is only needed by authenticated users (RLS/admin checks)
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Lock down public wrapper functions from PUBLIC; grant precisely to needed roles
REVOKE ALL ON FUNCTION public.upsert_customer_visit(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_customer_visit(uuid, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_customer_self(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_self(uuid, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.update_customer_self(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_customer_self(uuid, uuid, text, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.set_post_reaction(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_post_reaction(uuid, uuid, uuid, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.toggle_product_like(uuid, uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_product_like(uuid, uuid, uuid, boolean) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.toggle_product_wish(uuid, uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_product_wish(uuid, uuid, uuid, boolean) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.list_public_posts(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_posts(uuid, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.list_public_comments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_comments(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.list_customer_orders(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_customer_orders(uuid, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.create_customer_order(uuid, uuid, uuid, text, json, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_order(uuid, uuid, uuid, text, json, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.create_customer_post(uuid, uuid, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_post(uuid, uuid, uuid, text, text, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.create_customer_comment(uuid, uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_comment(uuid, uuid, uuid, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.create_checkin(uuid, uuid, uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_checkin(uuid, uuid, uuid, text, uuid, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.claim_own_company(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_own_company(text, text) TO authenticated;

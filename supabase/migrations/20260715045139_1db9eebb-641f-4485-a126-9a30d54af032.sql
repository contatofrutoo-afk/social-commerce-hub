
-- 1. Explicit restrictive policies on user_roles to prevent client-side role manipulation.
-- SECURITY DEFINER functions (like claim_own_company) bypass RLS and remain unaffected.
DROP POLICY IF EXISTS "Deny client role inserts" ON public.user_roles;
DROP POLICY IF EXISTS "Deny client role updates" ON public.user_roles;
DROP POLICY IF EXISTS "Deny client role deletes" ON public.user_roles;

CREATE POLICY "Deny client role inserts"
  ON public.user_roles AS RESTRICTIVE
  FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Deny client role updates"
  ON public.user_roles AS RESTRICTIVE
  FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny client role deletes"
  ON public.user_roles AS RESTRICTIVE
  FOR DELETE TO authenticated, anon
  USING (false);

-- 2. Replace the loose LIKE-based public storage read policy with strict full-path matching.
-- Requires the URL to end with '/weaze-media/<object-name>', preventing suffix collision attacks.
DROP POLICY IF EXISTS "Public read weaze-media referenced" ON storage.objects;

CREATE POLICY "Public read weaze-media referenced"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'weaze-media'
    AND (
      EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.logo_url LIKE '%/weaze-media/' || objects.name
      )
      OR EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.available = true
          AND COALESCE(p.status, 'active') = 'active'
          AND (
            p.image_url LIKE '%/weaze-media/' || objects.name
            OR p.video_url LIKE '%/weaze-media/' || objects.name
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.product_media pm
        JOIN public.products p ON p.id = pm.product_id
        WHERE p.available = true
          AND COALESCE(p.status, 'active') = 'active'
          AND pm.media_url LIKE '%/weaze-media/' || objects.name
      )
      OR EXISTS (
        SELECT 1 FROM public.posts po
        WHERE po.image_url LIKE '%/weaze-media/' || objects.name
      )
      OR EXISTS (
        SELECT 1 FROM public.comments cm
        WHERE cm.image_url LIKE '%/weaze-media/' || objects.name
      )
    )
  );


DROP POLICY IF EXISTS "Anyone can read product_media" ON public.product_media;
CREATE POLICY "Public read media for available products"
  ON public.product_media FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_media.product_id
        AND p.available = true
        AND COALESCE(p.status, 'active') = 'active'
    )
  );

DROP POLICY IF EXISTS "Public read weaze-media public folders" ON storage.objects;
DROP POLICY IF EXISTS "Public_read_weaze_media" ON storage.objects;
DROP POLICY IF EXISTS "Public read weaze-media" ON storage.objects;

CREATE POLICY "Public read weaze-media referenced"
  ON storage.objects FOR SELECT TO public
  USING (
    bucket_id = 'weaze-media' AND (
      EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.logo_url LIKE '%/' || storage.objects.name
      )
      OR EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.available = true
          AND COALESCE(p.status, 'active') = 'active'
          AND (
            p.image_url LIKE '%/' || storage.objects.name
            OR p.video_url LIKE '%/' || storage.objects.name
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.product_media pm
        JOIN public.products p ON p.id = pm.product_id
        WHERE p.available = true
          AND COALESCE(p.status, 'active') = 'active'
          AND pm.media_url LIKE '%/' || storage.objects.name
      )
      OR EXISTS (
        SELECT 1 FROM public.posts po
        WHERE po.image_url LIKE '%/' || storage.objects.name
      )
      OR EXISTS (
        SELECT 1 FROM public.comments cm
        WHERE cm.image_url LIKE '%/' || storage.objects.name
      )
    )
  );

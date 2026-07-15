DROP POLICY IF EXISTS "Company staff read post and comment media" ON storage.objects;
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
      SELECT 1 FROM comments cm
      WHERE cm.image_url LIKE '%/weaze-media/' || objects.name
    )
  )
);
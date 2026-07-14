-- =====================================================
-- Allow public read access to catalogo videos
-- Videos are stored under ${companyId}/catalogo/${uuid}.mp4
-- The current policy only allows first-level fixed folders
-- =====================================================

DROP POLICY IF EXISTS "Public read weaze-media public folders" ON storage.objects;

CREATE POLICY "Public read weaze-media public folders"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'weaze-media'
  AND (
    (storage.foldername(name))[1] = ANY (
      ARRAY['logos','business','posts','products','feed','publicar','general']
    )
    OR (storage.foldername(name))[2] = 'catalogo'
  )
);

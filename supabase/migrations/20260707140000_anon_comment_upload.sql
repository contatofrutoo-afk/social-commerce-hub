-- =========================
-- Permite que anônimos (non-authenticated) façam upload de fotos
-- em comentários no bucket weaze-media
-- =========================

DROP POLICY IF EXISTS "Anon can upload comment photos" ON storage.objects;
CREATE POLICY "Anon can upload comment photos"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'weaze-media'
    AND starts_with(name, 'comments/')
  );

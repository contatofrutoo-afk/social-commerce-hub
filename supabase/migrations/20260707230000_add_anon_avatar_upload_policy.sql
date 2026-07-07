-- Habilita upload de avatar por clientes (anon) no bucket weaze-media,
-- pasta avatars/<customerId>/

DROP POLICY IF EXISTS "Anon can upload avatars" ON storage.objects;

CREATE POLICY "Anon can upload avatars"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'weaze-media'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] IS NOT NULL
  );


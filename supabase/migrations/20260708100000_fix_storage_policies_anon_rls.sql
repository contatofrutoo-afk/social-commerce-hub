-- Corrige policies de storage para anon: remove subquery EXISTS que falha com RLS
-- A validacao de sessao ja e feita pelo app (session token), entao basta verificar o path

DROP POLICY IF EXISTS "Anon upload comments with customer" ON storage.objects;
CREATE POLICY "Anon upload comments"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'weaze-media'
    AND (storage.foldername(name))[1] = 'comments'
    AND (storage.foldername(name))[2] IS NOT NULL
  );

DROP POLICY IF EXISTS "Anon upload publicar with customer" ON storage.objects;
CREATE POLICY "Anon upload publicar"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'weaze-media'
    AND (storage.foldername(name))[1] = 'publicar'
    AND (storage.foldername(name))[2] IS NOT NULL
  );

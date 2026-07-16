
-- Politicas de acesso para o bucket privado weaze-private (avatares e imagens de comentarios de clientes B2C).
-- INSERT: qualquer visitante (anon) e usuarios autenticados podem enviar em avatars/* e comments/*.
-- SELECT: anon e authenticated podem ler (necessario para gerar signed URLs).
-- UPDATE/DELETE: apenas service_role (default).

CREATE POLICY "weaze_private_insert_avatars_comments"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'weaze-private'
  AND (name LIKE 'avatars/%' OR name LIKE 'comments/%')
);

CREATE POLICY "weaze_private_select_avatars_comments"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'weaze-private'
  AND (name LIKE 'avatars/%' OR name LIKE 'comments/%')
);

-- Migrar objetos existentes de avatares/comentarios do bucket publico para o privado.
UPDATE storage.objects
   SET bucket_id = 'weaze-private'
 WHERE bucket_id = 'weaze-media'
   AND (name LIKE 'avatars/%' OR name LIKE 'comments/%');

-- Invalidar URLs publicas antigas de avatares que agora vivem em bucket privado.
-- O cliente podera reenviar; o app passara a usar signed URLs para novos uploads.
UPDATE public.customers
   SET avatar_url = NULL
 WHERE avatar_url LIKE '%/storage/v1/object/public/weaze-media/avatars/%';

UPDATE public.comments
   SET image_url = NULL
 WHERE image_url LIKE '%/storage/v1/object/public/weaze-media/comments/%';

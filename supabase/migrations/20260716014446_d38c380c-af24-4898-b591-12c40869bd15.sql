-- Reforça as policies do bucket privado weaze-private:
-- INSERT/SELECT eram permitidos para anon/authenticated apenas com prefixo de
-- caminho ("avatars/..." ou "comments/..."), sem verificar dono. Agora os
-- uploads e leituras passam por um server function (service_role) que valida
-- a sessão do cliente antes de operar no Storage. Signed URLs continuam
-- funcionando para o público (não são afetados por RLS).

DROP POLICY IF EXISTS "weaze_private_insert_avatars_comments" ON storage.objects;
DROP POLICY IF EXISTS "weaze_private_select_avatars_comments" ON storage.objects;

-- Apenas service_role escreve/lê no bucket privado.
CREATE POLICY "weaze_private_service_role_insert"
  ON storage.objects
  FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'weaze-private');

CREATE POLICY "weaze_private_service_role_select"
  ON storage.objects
  FOR SELECT
  TO service_role
  USING (bucket_id = 'weaze-private');

CREATE POLICY "weaze_private_service_role_update"
  ON storage.objects
  FOR UPDATE
  TO service_role
  USING (bucket_id = 'weaze-private')
  WITH CHECK (bucket_id = 'weaze-private');

CREATE POLICY "weaze_private_service_role_delete"
  ON storage.objects
  FOR DELETE
  TO service_role
  USING (bucket_id = 'weaze-private');
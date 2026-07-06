-- ============================================
-- Criar bucket weaze-media no Storage
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('weaze-media', 'weaze-media', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Política: qualquer um pode ler imagens (público)
DROP POLICY IF EXISTS "Public read" ON storage.objects;
CREATE POLICY "Public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'weaze-media');

-- Política: autenticados podem fazer upload
DROP POLICY IF EXISTS "Authenticated upload" ON storage.objects;
CREATE POLICY "Authenticated upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'weaze-media');

-- Política: autenticados podem atualizar/deletar próprios uploads
DROP POLICY IF EXISTS "Authenticated manage own" ON storage.objects;
CREATE POLICY "Authenticated manage own" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'weaze-media' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'weaze-media' AND owner = auth.uid());


-- 1) Garante que anon pode SELECT em customers (necessário para a policy de INSERT em posts)
GRANT SELECT ON public.customers TO anon;

-- 2) Policy de storage para anon fazer upload em publicar/ (compartilhar experiência)
DROP POLICY IF EXISTS "Anon can upload publish photos" ON storage.objects;
CREATE POLICY "Anon can upload publish photos"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'weaze-media'
    AND starts_with(name, 'publicar/')
  );

-- 3) Policy de storage para anon fazer upload em comments/ (já deve existir, mas garantimos)
DROP POLICY IF EXISTS "Anon can upload comment photos" ON storage.objects;
CREATE POLICY "Anon can upload comment photos"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'weaze-media'
    AND starts_with(name, 'comments/')
  );

-- 4) Policy de storage para anon fazer upload em feed/ (caso necessário)
DROP POLICY IF EXISTS "Anon can upload feed photos" ON storage.objects;
CREATE POLICY "Anon can upload feed photos"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'weaze-media'
    AND starts_with(name, 'feed/')
  );

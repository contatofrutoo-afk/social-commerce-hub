
-- =========================================================
-- 1) Garante que as colunas existem (caso falte alguma)
-- =========================================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS welcome_message text DEFAULT 'Bem-vindo!';

-- =========================================================
-- 2) Política de UPDATE para companies (a que faltava)
-- =========================================================
DROP POLICY IF EXISTS "Company members update companies" ON public.companies;
CREATE POLICY "Company members update companies"
  ON public.companies
  FOR UPDATE TO authenticated
  USING (private.has_company_access(auth.uid(), id))
  WITH CHECK (private.has_company_access(auth.uid(), id));

-- =========================================================
-- 3) Política de DELETE para companies (também ausente)
-- =========================================================
DROP POLICY IF EXISTS "Company members delete companies" ON public.companies;
CREATE POLICY "Company members delete companies"
  ON public.companies
  FOR DELETE TO authenticated
  USING (private.has_company_access(auth.uid(), id));

-- =========================================================
-- 4) Storage bucket para logos (caso não exista)
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('weaze-media', 'weaze-media', true)
  ON CONFLICT (id) DO NOTHING;

-- Garante que o bucket tem política de SELECT público
DROP POLICY IF EXISTS "Public read" ON storage.objects;
CREATE POLICY "Public read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'weaze-media');

-- Política de upload para autenticados na pasta da empresa
DROP POLICY IF EXISTS "Authenticated upload" ON storage.objects;
CREATE POLICY "Authenticated upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'weaze-media'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

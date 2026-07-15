DROP POLICY IF EXISTS "Public read available products" ON public.products;
CREATE POLICY "Public read available products"
  ON public.products FOR SELECT TO anon, authenticated
  USING (available = true AND COALESCE(status, 'active') = 'active');
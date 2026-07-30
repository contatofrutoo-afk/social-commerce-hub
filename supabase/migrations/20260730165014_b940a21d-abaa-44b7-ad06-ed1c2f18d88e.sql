DROP POLICY IF EXISTS "Company members delete checkins" ON public.checkins;
CREATE POLICY "Company members delete checkins"
  ON public.checkins FOR DELETE TO authenticated
  USING (private.has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Company members delete customers" ON public.customers;
CREATE POLICY "Company members delete customers"
  ON public.customers FOR DELETE TO authenticated
  USING (private.has_company_access(auth.uid(), company_id));
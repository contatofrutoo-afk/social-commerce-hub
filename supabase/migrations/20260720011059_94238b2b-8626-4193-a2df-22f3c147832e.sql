
-- Consolidate companies admin policies to use has_role only
DROP POLICY IF EXISTS "Admin deleta companies" ON public.companies;
DROP POLICY IF EXISTS "Admin gerencia companies" ON public.companies;

-- Standardize customers/checkins DELETE to has_company_access
DROP POLICY IF EXISTS "Company members delete customers" ON public.customers;
CREATE POLICY "Company members delete customers" ON public.customers
  FOR DELETE USING (private.has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Company members delete checkins" ON public.checkins;
CREATE POLICY "Company members delete checkins" ON public.checkins
  FOR DELETE USING (private.has_company_access(auth.uid(), company_id));

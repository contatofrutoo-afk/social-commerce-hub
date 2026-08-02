DROP POLICY IF EXISTS "Anyone can read customers" ON public.customers;
CREATE POLICY "Company members read customers"
ON public.customers FOR SELECT TO authenticated
USING (private.has_company_access(auth.uid(), company_id));
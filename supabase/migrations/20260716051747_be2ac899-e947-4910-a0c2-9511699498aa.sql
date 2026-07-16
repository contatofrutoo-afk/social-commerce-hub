
DROP POLICY IF EXISTS "b2c_customers_insert_auth" ON public.b2c_customers;
DROP POLICY IF EXISTS "b2c_customers_update_auth" ON public.b2c_customers;
DROP POLICY IF EXISTS "checkins_insert_auth" ON public.checkins;
DROP POLICY IF EXISTS "companies_select_authenticated" ON public.companies;

CREATE POLICY "b2c_customers_insert_company_staff" ON public.b2c_customers
  FOR INSERT TO authenticated
  WITH CHECK (private.has_company_access(auth.uid(), company_id));

CREATE POLICY "b2c_customers_update_company_staff" ON public.b2c_customers
  FOR UPDATE TO authenticated
  USING (private.has_company_access(auth.uid(), company_id))
  WITH CHECK (private.has_company_access(auth.uid(), company_id));

CREATE POLICY "checkins_insert_company_staff" ON public.checkins
  FOR INSERT TO authenticated
  WITH CHECK (private.has_company_access(auth.uid(), company_id));

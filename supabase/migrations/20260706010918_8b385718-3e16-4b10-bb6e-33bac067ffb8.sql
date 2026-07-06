
-- 1. checkins: restrict SELECT to company members
DROP POLICY IF EXISTS "Checkins readable" ON public.checkins;
REVOKE SELECT ON public.checkins FROM anon;

-- 2. Replace WITH CHECK (true) INSERT policies with validation
DROP POLICY IF EXISTS "Anyone can create checkin" ON public.checkins;
CREATE POLICY "Anyone can create checkin" ON public.checkins
FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id));

DROP POLICY IF EXISTS "Anyone can register as customer" ON public.customers;
CREATE POLICY "Anyone can register as customer" ON public.customers
FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id));

DROP POLICY IF EXISTS "Anyone can create order" ON public.orders;
CREATE POLICY "Anyone can create order" ON public.orders
FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id)
  AND EXISTS (SELECT 1 FROM public.customers cu WHERE cu.id = customer_id AND cu.company_id = orders.company_id)
);

DROP POLICY IF EXISTS "Anyone can create order item" ON public.order_items;
CREATE POLICY "Anyone can create order item" ON public.order_items
FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id));

-- 3. Move helper SECURITY DEFINER functions out of exposed public schema
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.has_company_access(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND company_id = _company_id) $$;

CREATE OR REPLACE FUNCTION private.current_user_company()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1 $$;

REVOKE ALL ON FUNCTION private.has_company_access(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_user_company() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_company_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_company() TO authenticated;

-- 4. Recreate all policies referencing public.has_company_access to use private.*
-- customers
DROP POLICY IF EXISTS "Company members read customers" ON public.customers;
CREATE POLICY "Company members read customers" ON public.customers
FOR SELECT TO authenticated USING (private.has_company_access(auth.uid(), company_id));
DROP POLICY IF EXISTS "Company members update customers" ON public.customers;
CREATE POLICY "Company members update customers" ON public.customers
FOR UPDATE TO authenticated
USING (private.has_company_access(auth.uid(), company_id))
WITH CHECK (private.has_company_access(auth.uid(), company_id));

-- checkins SELECT
CREATE POLICY "Company members read checkins" ON public.checkins
FOR SELECT TO authenticated USING (private.has_company_access(auth.uid(), company_id));

-- orders
DROP POLICY IF EXISTS "Company members read orders" ON public.orders;
CREATE POLICY "Company members read orders" ON public.orders
FOR SELECT TO authenticated USING (private.has_company_access(auth.uid(), company_id));
DROP POLICY IF EXISTS "Company members manage orders" ON public.orders;
CREATE POLICY "Company members manage orders" ON public.orders
FOR ALL TO authenticated
USING (private.has_company_access(auth.uid(), company_id))
WITH CHECK (private.has_company_access(auth.uid(), company_id));

-- order_items
DROP POLICY IF EXISTS "Company members read order items" ON public.order_items;
CREATE POLICY "Company members read order items" ON public.order_items
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND private.has_company_access(auth.uid(), o.company_id)));
DROP POLICY IF EXISTS "Company members manage order items" ON public.order_items;
CREATE POLICY "Company members manage order items" ON public.order_items
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND private.has_company_access(auth.uid(), o.company_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND private.has_company_access(auth.uid(), o.company_id)));

-- tables
DROP POLICY IF EXISTS "Company members manage tables" ON public.tables;
CREATE POLICY "Company members manage tables" ON public.tables
FOR ALL TO authenticated
USING (private.has_company_access(auth.uid(), company_id))
WITH CHECK (private.has_company_access(auth.uid(), company_id));

-- products
DROP POLICY IF EXISTS "Company members manage products" ON public.products;
CREATE POLICY "Company members manage products" ON public.products
FOR ALL TO authenticated
USING (private.has_company_access(auth.uid(), company_id))
WITH CHECK (private.has_company_access(auth.uid(), company_id));

-- posts
DROP POLICY IF EXISTS "Company members manage posts" ON public.posts;
CREATE POLICY "Company members manage posts" ON public.posts
FOR ALL TO authenticated
USING (private.has_company_access(auth.uid(), company_id))
WITH CHECK (private.has_company_access(auth.uid(), company_id));

-- post_products
DROP POLICY IF EXISTS "Company members manage post-products" ON public.post_products;
CREATE POLICY "Company members manage post-products" ON public.post_products
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_products.post_id AND private.has_company_access(auth.uid(), p.company_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_products.post_id AND private.has_company_access(auth.uid(), p.company_id)));

-- 5. Finally drop the public schema helper functions
DROP FUNCTION IF EXISTS public.has_company_access(uuid, uuid);
DROP FUNCTION IF EXISTS public.current_user_company();

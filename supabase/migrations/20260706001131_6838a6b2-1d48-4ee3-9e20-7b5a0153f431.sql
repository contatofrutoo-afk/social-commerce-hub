
-- customers: remove public SELECT + permissive UPDATE
DROP POLICY IF EXISTS "Customers readable by anyone" ON public.customers;
DROP POLICY IF EXISTS "Anyone can update customer" ON public.customers;
CREATE POLICY "Company members read customers" ON public.customers
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "Company members update customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- orders: remove public SELECT
DROP POLICY IF EXISTS "Orders readable" ON public.orders;
CREATE POLICY "Company members read orders" ON public.orders
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

-- order_items: remove public SELECT
DROP POLICY IF EXISTS "Order items readable" ON public.order_items;
CREATE POLICY "Company members read order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND public.has_company_access(auth.uid(), o.company_id)
  ));
CREATE POLICY "Company members manage order items" ON public.order_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND public.has_company_access(auth.uid(), o.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND public.has_company_access(auth.uid(), o.company_id)
  ));

-- post_products: restrict authenticated ALL to company members via post
DROP POLICY IF EXISTS "Auth manages post-products" ON public.post_products;
CREATE POLICY "Company members manage post-products" ON public.post_products
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_products.post_id
      AND public.has_company_access(auth.uid(), p.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_products.post_id
      AND public.has_company_access(auth.uid(), p.company_id)
  ));

-- post_reactions: drop permissive DELETE/UPDATE
DROP POLICY IF EXISTS "Anyone can remove reaction" ON public.post_reactions;
DROP POLICY IF EXISTS "Anyone can update reaction" ON public.post_reactions;

-- product_likes DELETE and product_wishes DELETE: drop permissive
DROP POLICY IF EXISTS "Anyone can unlike" ON public.product_likes;
DROP POLICY IF EXISTS "Anyone can unwish" ON public.product_wishes;

-- Lock down SECURITY DEFINER helper functions
REVOKE EXECUTE ON FUNCTION public.has_company_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_company() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_company_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_company() TO authenticated, service_role;

-- Revoke anon Data API access to sensitive tables so no policy can accidentally reopen them
REVOKE SELECT, UPDATE, DELETE ON public.customers FROM anon;
REVOKE SELECT, UPDATE, DELETE ON public.orders FROM anon;
REVOKE SELECT, UPDATE, DELETE ON public.order_items FROM anon;
REVOKE UPDATE, DELETE ON public.post_reactions FROM anon;
REVOKE DELETE ON public.product_likes FROM anon;
REVOKE DELETE ON public.product_wishes FROM anon;

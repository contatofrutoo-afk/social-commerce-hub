-- 1) checkins: remove anon/authenticated blanket INSERT
DROP POLICY IF EXISTS "Anyone can create checkin" ON public.checkins;

-- 2) order_item_options: only company staff may write directly.
DROP POLICY IF EXISTS "Order item options write via definer" ON public.order_item_options;
CREATE POLICY "Company members write order_item_options"
  ON public.order_item_options FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.id = order_item_options.order_item_id
      AND private.has_company_access(auth.uid(), o.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.id = order_item_options.order_item_id
      AND private.has_company_access(auth.uid(), o.company_id)
  ));

-- 3) product options: public read limited to available/active products
DROP POLICY IF EXISTS "Anyone can read product_options" ON public.product_options;
CREATE POLICY "Anyone can read product_options"
  ON public.product_options FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_options.product_id
      AND p.available = true
      AND p.status = 'active'
  ));

DROP POLICY IF EXISTS "Anyone can read product_option_values" ON public.product_option_values;
CREATE POLICY "Anyone can read product_option_values"
  ON public.product_option_values FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.product_options po
    JOIN public.products p ON p.id = po.product_id
    WHERE po.id = product_option_values.option_id
      AND p.available = true
      AND p.status = 'active'
  ));
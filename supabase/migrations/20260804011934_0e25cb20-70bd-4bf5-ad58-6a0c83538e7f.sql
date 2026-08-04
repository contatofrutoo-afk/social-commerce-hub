DROP POLICY IF EXISTS "Anyone can insert product_events" ON public.product_events;

CREATE POLICY "Company members insert product_events"
ON public.product_events
FOR INSERT
TO authenticated
WITH CHECK (private.has_company_access(auth.uid(), company_id));

CREATE OR REPLACE FUNCTION public.record_product_event(
  _product_id uuid,
  _company_id uuid,
  _customer_id uuid DEFAULT NULL::uuid,
  _event_type text DEFAULT 'view'::text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_customer uuid := _customer_id;
BEGIN
  IF _event_type IS NULL OR _event_type NOT IN ('view', 'scan', 'cart_add', 'purchase', 'like', 'wish', 'share') THEN
    RAISE EXCEPTION 'invalid event type';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = _product_id AND p.company_id = _company_id
  ) THEN
    RAISE EXCEPTION 'invalid product for company';
  END IF;

  IF v_customer IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = v_customer AND c.company_id = _company_id
  ) THEN
    v_customer := NULL;
  END IF;

  INSERT INTO public.product_events (product_id, company_id, customer_id, event_type, metadata)
  VALUES (_product_id, _company_id, v_customer, _event_type, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
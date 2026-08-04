CREATE OR REPLACE FUNCTION public.admin_list_platform_payments()
RETURNS TABLE (
  id uuid,
  company_id uuid,
  company_name text,
  order_id uuid,
  payment_origin text,
  payment_method text,
  payment_status text,
  gross_amount numeric,
  net_amount numeric,
  mercadopago_payment_id text,
  paid_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem consultar o financeiro da plataforma';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.company_id,
    c.name AS company_name,
    o.id AS order_id,
    CASE
      WHEN lower(coalesce(o.payment_provider, '')) IN ('mercadopago', 'mercado_pago', 'mp') THEN 'mercado_pago'
      ELSE 'cashier'
    END AS payment_origin,
    CASE lower(coalesce(o.payment_method, ''))
      WHEN 'pix' THEN 'pix'
      WHEN 'card' THEN 'credit_card'
      WHEN 'credit_card' THEN 'credit_card'
      WHEN 'credit' THEN 'credit_card'
      WHEN 'debit_card' THEN 'debit_card'
      WHEN 'debit' THEN 'debit_card'
      WHEN 'counter' THEN 'cash'
      WHEN 'cash' THEN 'cash'
      WHEN 'dinheiro' THEN 'cash'
      ELSE 'other'
    END AS payment_method,
    CASE lower(coalesce(o.payment_status, 'pending'))
      WHEN 'paid' THEN 'approved'
      WHEN 'approved' THEN 'approved'
      ELSE lower(coalesce(o.payment_status, 'pending'))
    END AS payment_status,
    coalesce(o.total, 0)::numeric AS gross_amount,
    coalesce(o.total, 0)::numeric AS net_amount,
    o.payment_id AS mercadopago_payment_id,
    coalesce(o.payment_approved_at, o.created_at) AS paid_at,
    o.created_at
  FROM public.orders o
  LEFT JOIN public.companies c ON c.id = o.company_id
  ORDER BY coalesce(o.payment_approved_at, o.created_at) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_platform_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_platform_payments() TO authenticated;
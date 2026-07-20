-- Corrige list_service_present_public para excluir check-ins com checkout
-- feito (checked_out_at IS NOT NULL). Sem isso, clientes que fizeram checkout
-- continuavam aparecendo como "presentes".

CREATE OR REPLACE FUNCTION public.list_service_present_public(
  _company_id uuid,
  _minutes int DEFAULT 480
)
RETURNS TABLE(
  id uuid,
  company_id uuid,
  customer_id uuid,
  table_id uuid,
  context text,
  source text,
  created_at timestamptz,
  customer_name text,
  customer_avatar_url text,
  customer_visit_count int,
  customer_first_visit_at timestamptz,
  customer_last_visit_at timestamptz,
  table_label text,
  table_slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ch.id,
    ch.company_id,
    ch.customer_id,
    ch.table_id,
    ch.context::text,
    ch.source,
    ch.created_at,
    c.name AS customer_name,
    c.avatar_url AS customer_avatar_url,
    c.visit_count AS customer_visit_count,
    c.first_visit_at AS customer_first_visit_at,
    c.last_visit_at AS customer_last_visit_at,
    t.label AS table_label,
    t.slug AS table_slug
  FROM public.checkins ch
  LEFT JOIN public.customers c ON c.id = ch.customer_id
  LEFT JOIN public.tables t ON t.id = ch.table_id
  WHERE ch.company_id = _company_id
    AND ch.created_at >= now() - make_interval(mins => _minutes)
    AND ch.checked_out_at IS NULL
  ORDER BY ch.created_at DESC;
$$;

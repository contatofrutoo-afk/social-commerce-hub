
-- Public snapshot: tables of a company (used by /c/:slug/vendas)
CREATE OR REPLACE FUNCTION public.list_service_tables_public(_company_id uuid)
RETURNS TABLE(id uuid, company_id uuid, label text, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.company_id, t.label, t.slug
    FROM public.tables t
   WHERE t.company_id = _company_id
   ORDER BY t.label;
$$;

REVOKE ALL ON FUNCTION public.list_service_tables_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_service_tables_public(uuid) TO anon, authenticated, service_role;

-- Public snapshot: recent checkins with minimal customer info
CREATE OR REPLACE FUNCTION public.list_service_present_public(_company_id uuid, _minutes int DEFAULT 480)
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
   ORDER BY ch.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_service_present_public(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_service_present_public(uuid, int) TO anon, authenticated, service_role;

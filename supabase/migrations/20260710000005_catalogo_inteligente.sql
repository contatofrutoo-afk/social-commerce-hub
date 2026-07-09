-- ============================================================
-- Catálogo Inteligente — WEAZE
-- ============================================================

-- 1. Novas colunas na tabela products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  ADD COLUMN IF NOT EXISTS stock_quantity integer,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS internal_code text,
  ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scan_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cart_additions_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_customers integer NOT NULL DEFAULT 0;

-- Slug único por empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug_company
  ON public.products(company_id, slug) WHERE slug IS NOT NULL;

-- 2. Tabela de eventos do produto
CREATE TABLE IF NOT EXISTS public.product_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('view', 'scan', 'cart_add', 'cart_remove', 'purchase')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_events_product ON public.product_events(product_id);
CREATE INDEX IF NOT EXISTS idx_product_events_company ON public.product_events(company_id);
CREATE INDEX IF NOT EXISTS idx_product_events_customer ON public.product_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_product_events_type ON public.product_events(event_type);

-- RLS
ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage product_events"
  ON public.product_events
  FOR ALL TO authenticated
  USING (private.has_company_access(auth.uid(), company_id))
  WITH CHECK (private.has_company_access(auth.uid(), company_id));

-- Anon pode inserir eventos (para rastrear visoes do QR)
CREATE POLICY "Anyone can insert product_events"
  ON public.product_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 3. Função para incrementar contadores do produto
CREATE OR REPLACE FUNCTION public.increment_product_counter(_product_id uuid, _field text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE format('UPDATE products SET %I = COALESCE(%I, 0) + 1 WHERE id = $1', _field, _field)
  USING _product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_product_counter(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_product_counter(uuid, text) TO anon, authenticated;

-- 4. Função para registrar evento
CREATE OR REPLACE FUNCTION public.record_product_event(
  _product_id uuid,
  _company_id uuid,
  _customer_id uuid DEFAULT NULL,
  _event_type text DEFAULT 'view',
  _metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO product_events (product_id, company_id, customer_id, event_type, metadata)
    VALUES (_product_id, _company_id, _customer_id, _event_type, _metadata)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_product_event(uuid, uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_product_event(uuid, uuid, uuid, text, jsonb) TO anon, authenticated;

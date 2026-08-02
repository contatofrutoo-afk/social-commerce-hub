-- ============================================================
-- WEAZE — ETAPA 4: MERCADO PAGO (CÓDIGO PARA COLAR NO SUPABASE)
-- ============================================================
-- Colar no: Supabase Dashboard -> SQL Editor -> New query -> Run
--
-- Este script é o resumo das migrations 090000 (merchant_payment_accounts),
-- 100000 (orders etapa4), 110000 (RPCs) e 120000 (platform_settings).
-- É seguro reexecutar (idempotente): não quebra se já foi aplicado antes.
--
-- O que cria:
--   1. merchant_payment_accounts  — conta MP de cada estabelecimento (OAuth)
--   2. payment_oauth_states       — colunas de suporte ao PKCE
--   3. orders / order_items       — colunas da Etapa 4 + novos status
--   4. create_customer_order / list_customer_orders — RPCs com pagamento online
--   5. platform_settings          — credenciais globais (painel admin)
--
-- Depois de rodar, preencha as credenciais em Admin -> Configurações ->
-- "Mercado Pago — Credenciais".
-- ============================================================

-- ################################################################
-- 1) merchant_payment_accounts
-- ################################################################
-- Tabela merchant_payment_accounts conforme o contrato da Etapa 4.
-- Cada estabelecimento usa a própria conta Mercado Pago (OAuth).
-- A WEAZE nunca recebe dinheiro, nunca faz split e nunca é
-- intermediadora financeira: os tokens pertencem ao comerciante.
--
-- Segurança:
--  - Tokens (access_token/refresh_token) são legíveis apenas por
--    service_role (backend). O painel vê somente dados públicos.
--  - A criptografia dos tokens é feita na camada de aplicação
--    (AES-256-GCM, chave via MERCADO_PAGO_ENCRYPTION_KEY) antes de
--    persistir — o banco nunca recebe credencial em texto puro.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merchant_payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mercadopago',
  provider_user_id text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  connected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, provider)
);

CREATE INDEX IF NOT EXISTS merchant_payment_accounts_merchant_idx
  ON public.merchant_payment_accounts (merchant_id);

ALTER TABLE public.merchant_payment_accounts ENABLE ROW LEVEL SECURITY;

-- Nenhuma role pública lê/escreve tokens. Somente service_role (backend).
REVOKE ALL ON public.merchant_payment_accounts FROM anon, authenticated;
GRANT ALL ON public.merchant_payment_accounts TO service_role;

-- Trigger simples de updated_at
CREATE OR REPLACE FUNCTION private.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS merchant_payment_accounts_set_updated_at
  ON public.merchant_payment_accounts;
CREATE TRIGGER merchant_payment_accounts_set_updated_at
  BEFORE UPDATE ON public.merchant_payment_accounts
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

-- ------------------------------------------------------------
-- payment_oauth_states: suporte a PKCE
-- ------------------------------------------------------------
ALTER TABLE public.payment_oauth_states
  ADD COLUMN IF NOT EXISTS code_verifier text,
  ADD COLUMN IF NOT EXISTS code_challenge text;

-- ################################################################
-- 2) ORDERS — PEDIDOS COM PAGAMENTO ONLINE
-- ################################################################
-- Novos status do fluxo de pagamento online:
--   awaiting_payment  -> Aguardando pagamento
--   payment_approved  -> Pagamento aprovado
--   delivered         -> Entregue
-- Os status antigos (received, payment_at_counter, preparing,
-- ready, completed, cancelled) são mantidos para pedidos legados.
-- ------------------------------------------------------------
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'awaiting_payment';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'payment_approved';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'delivered';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS customer_session_id text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  ADD COLUMN IF NOT EXISTS payment_provider text
    CHECK (payment_provider IS NULL OR payment_provider IN ('mercadopago', 'counter')),
  ADD COLUMN IF NOT EXISTS payment_id text,
  ADD COLUMN IF NOT EXISTS payment_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS subtotal numeric(10, 2),
  ADD COLUMN IF NOT EXISTS discount numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- updated_at automático para orders
CREATE OR REPLACE FUNCTION public.touch_order_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_set_updated_at ON public.orders;
CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_order_updated_at();

CREATE INDEX IF NOT EXISTS orders_merchant_created_idx
  ON public.orders (merchant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_payment_id_idx
  ON public.orders (payment_id);

-- order_items.total: coluna gerada (quantidade x unit_price)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS total numeric(10, 2)
    GENERATED ALWAYS AS (quantity * unit_price) STORED;

-- ################################################################
-- 3) RPCs — PEDIDOS COM PAGAMENTO ONLINE
-- ################################################################
-- create_customer_order:
--   - _payment_provider (mercadopago | counter) define o status inicial:
--       mercadopago -> 'awaiting_payment' + payment_status 'pending'
--       counter      -> 'payment_at_counter' + payment_status 'pending'
--   - grava merchant_id, customer_session_id, subtotal, discount.
-- list_customer_orders devolve as novas colunas da Etapa 4.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_customer_order(uuid, uuid, uuid, text, json, uuid, text, text, text);
DROP FUNCTION IF EXISTS private.create_customer_order(uuid, uuid, uuid, text, json, uuid, text, text, text);

CREATE OR REPLACE FUNCTION private.create_customer_order(
  _customer_id uuid,
  _token uuid,
  _company_id uuid,
  _note text,
  _items json,
  _table_id uuid DEFAULT NULL,
  _payment_method text DEFAULT NULL,
  _payment_provider text DEFAULT NULL,
  _session_id text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_order_id uuid;
  v_total numeric := 0;
  v_table uuid;
  v_status public.order_status;
  item json;
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id=_customer_id AND company_id=_company_id) THEN
    RAISE EXCEPTION 'company mismatch';
  END IF;
  IF _items IS NULL OR json_array_length(_items) = 0 THEN RAISE EXCEPTION 'empty cart'; END IF;
  IF _payment_method IS NOT NULL AND _payment_method NOT IN ('pix', 'card', 'counter') THEN
    RAISE EXCEPTION 'invalid payment method';
  END IF;
  IF _payment_provider IS NOT NULL AND _payment_provider NOT IN ('mercadopago', 'counter') THEN
    RAISE EXCEPTION 'invalid payment provider';
  END IF;

  v_table := _table_id;
  IF v_table IS NULL THEN
    SELECT table_id INTO v_table
      FROM checkins
      WHERE customer_id=_customer_id AND company_id=_company_id
      ORDER BY created_at DESC LIMIT 1;
  END IF;

  FOR item IN SELECT * FROM json_array_elements(_items) LOOP
    v_total := v_total + (item->>'price')::numeric * (item->>'quantity')::int;
  END LOOP;

  v_status := CASE
    WHEN _payment_provider = 'mercadopago' THEN 'awaiting_payment'::public.order_status
    WHEN _payment_method = 'counter' THEN 'payment_at_counter'::public.order_status
    ELSE 'received'::public.order_status
  END;

  INSERT INTO orders (
    company_id, merchant_id, customer_id, customer_session_id, table_id, note,
    total, subtotal, discount, status, payment_method, payment_provider, payment_status)
  VALUES (
    _company_id, _company_id, _customer_id, NULLIF(btrim(COALESCE(_session_id,'')), ''), v_table,
    NULLIF(btrim(COALESCE(_note,'')), ''), v_total, v_total, 0, v_status,
    _payment_method, _payment_provider,
    CASE WHEN _payment_provider = 'mercadopago' THEN 'pending' ELSE 'pending' END)
  RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, unit_price, note)
  SELECT v_order_id,
         (item->>'productId')::uuid,
         (item->>'quantity')::int,
         (item->>'price')::numeric,
         NULLIF(btrim(COALESCE(item->>'note','')), '')
  FROM json_array_elements(_items) AS item;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_customer_order(
  _customer_id uuid,
  _token uuid,
  _company_id uuid,
  _note text,
  _items json,
  _table_id uuid DEFAULT NULL,
  _payment_method text DEFAULT NULL,
  _payment_provider text DEFAULT NULL,
  _session_id text DEFAULT NULL)
RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
  SELECT private.create_customer_order(_customer_id, _token, _company_id, _note, _items, _table_id, _payment_method, _payment_provider, _session_id);
$$;

REVOKE ALL ON FUNCTION public.create_customer_order(uuid, uuid, uuid, text, json, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_order(uuid, uuid, uuid, text, json, uuid, text, text, text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.list_customer_orders(uuid, uuid);
DROP FUNCTION IF EXISTS private.list_customer_orders(uuid, uuid);

CREATE OR REPLACE FUNCTION private.list_customer_orders(_customer_id uuid, _token uuid)
RETURNS SETOF json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY
  SELECT to_json(x) FROM (
    SELECT o.id, o.company_id, o.merchant_id, o.customer_id, o.customer_session_id,
           o.table_id, o.status, o.payment_status, o.payment_provider, o.payment_id,
           o.subtotal, o.discount, o.total, o.note, o.payment_method, o.created_at,
      json_build_object('label', t.label) AS "table",
      COALESCE((
        SELECT json_agg(json_build_object(
          'id',oi.id,'order_id',oi.order_id,'product_id',oi.product_id,
          'quantity',oi.quantity,'unit_price',oi.unit_price,'total',oi.total,'note',oi.note,
          'product', json_build_object('name', pr.name)))
        FROM order_items oi LEFT JOIN products pr ON pr.id=oi.product_id
        WHERE oi.order_id=o.id
      ), '[]'::json) AS order_items
    FROM orders o LEFT JOIN tables t ON t.id=o.table_id
    WHERE o.customer_id=_customer_id
    ORDER BY o.created_at DESC
  ) x;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_customer_orders(_customer_id uuid, _token uuid)
RETURNS SETOF json
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT * FROM private.list_customer_orders(_customer_id, _token);
$$;

REVOKE ALL ON FUNCTION public.list_customer_orders(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_customer_orders(uuid, uuid) TO anon, authenticated;

-- ################################################################
-- 4) platform_settings — CREDENCIAIS GLOBAIS DO MERCADO PAGO
-- ################################################################
-- Uma única linha (id=1). Sem policies: apenas o service_role
-- (código servidor) lê/grava. Os valores nunca chegam ao cliente.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mercadopago_client_id text,
  mercadopago_client_secret text,
  mercadopago_public_key text,
  mercadopago_access_token text,
  mercadopago_webhook_secret text,
  mercadopago_redirect_uri text,
  mercadopago_encryption_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.platform_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ################################################################
-- 5) VERIFICAÇÃO (opcional — pode rodar de novo para conferir)
-- ################################################################
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema='public' AND table_name='orders'
       AND column_name IN ('payment_status','payment_provider','payment_id','merchant_id','subtotal','discount','updated_at')) > 0 AS orders_etapa4_ok,
  EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
            WHERE t.typname='order_status' AND e.enumlabel IN ('awaiting_payment','payment_approved','delivered')) AS novos_status_ok,
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='merchant_payment_accounts') AS merchant_accounts_ok,
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='platform_settings') AS platform_settings_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='payment_oauth_states'
              AND column_name IN ('code_verifier','code_challenge')) AS pkce_ok;

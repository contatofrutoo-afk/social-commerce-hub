-- ============================================================
-- Credenciais do Mercado Pago configuradas pelo painel admin.
-- Uma única linha (id=1). Sem policies: apenas o service_role
-- (código servidor) lê/grava. Os valores nunca chegam ao cliente.
-- ============================================================

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

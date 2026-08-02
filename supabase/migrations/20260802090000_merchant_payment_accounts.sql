-- ============================================================
-- ETAPA 4 — MERCADO PAGO
--
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
--
-- Seguro reexecutar.
-- ============================================================

-- ------------------------------------------------------------
-- merchant_payment_accounts
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

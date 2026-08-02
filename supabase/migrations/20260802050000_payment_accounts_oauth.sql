-- ============================================================
-- MÓDULO FINANCEIRO — conexão OAuth do Mercado Pago
--
-- 1. payment_accounts ganha as colunas de credenciais OAuth
--    (provider_user_id, access_token, refresh_token, expires_at).
-- 2. payment_oauth_states guarda o state token de cada fluxo OAuth
--    em andamento (vínculo do fluxo com o business_id e validação
--    anti-CSRF), expirando em minutos.
-- 3. Dados sensíveis (credentials, access_token, refresh_token)
--    deixam de ser legíveis/graváveis por membros autenticados:
--    toda comunicação com o Mercado Pago passa pelo backend
--    (service_role), nunca pelo frontend.
--
-- Seguro reexecutar: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF
-- NOT EXISTS, REVOKE/GRANT idempotentes.
-- ============================================================

-- ------------------------------------------------------------
-- payment_accounts: colunas do OAuth
-- ------------------------------------------------------------
ALTER TABLE public.payment_accounts
  ADD COLUMN IF NOT EXISTS provider_user_id text,
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- ------------------------------------------------------------
-- payment_oauth_states: fluxo OAuth em andamento
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  state text NOT NULL UNIQUE,
  redirect_uri text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_oauth_states_business_id_idx
  ON public.payment_oauth_states (business_id);

CREATE INDEX IF NOT EXISTS payment_oauth_states_state_idx
  ON public.payment_oauth_states (state);

ALTER TABLE public.payment_oauth_states ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.payment_oauth_states TO service_role;

-- ------------------------------------------------------------
-- Restrição de acesso a dados sensíveis de payment_accounts:
-- somente o backend (service_role) lê/escreve tokens OAuth.
-- ------------------------------------------------------------
REVOKE ALL ON public.payment_accounts FROM authenticated;
GRANT SELECT (
  id,
  business_id,
  provider,
  status,
  account_name,
  account_id,
  provider_user_id,
  last_sync_at,
  connected_at,
  created_at,
  updated_at,
  expires_at
) ON public.payment_accounts TO authenticated;
GRANT ALL ON public.payment_accounts TO service_role;

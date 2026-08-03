-- ============================================================
-- Colunas que o código do Financeiro/OAuth espera em
-- merchant_payment_accounts (account_name, account_id,
-- connected_at, last_sync_at) e que faltavam na criação.
--
-- Seguro reexecutar.
-- ============================================================

ALTER TABLE public.merchant_payment_accounts
  ADD COLUMN IF NOT EXISTS account_name text,
  ADD COLUMN IF NOT EXISTS account_id text,
  ADD COLUMN IF NOT EXISTS connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;

-- Força o PostgREST a recarregar o schema cache (senão ele devolve
-- "Could not find the 'account_id' column ... in the schema cache").
NOTIFY pgrst, 'reload schema';

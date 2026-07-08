-- ============================================================
-- Adiciona colunas que faltam na tabela companies para o admin
-- ============================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS responsible text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email_principal text,
  ADD COLUMN IF NOT EXISTS responsible_email text,
  ADD COLUMN IF NOT EXISTS city text;

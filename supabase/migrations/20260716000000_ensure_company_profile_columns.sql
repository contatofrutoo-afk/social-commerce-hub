-- Adiciona colunas de perfil na tabela companies (idempotente)
-- Usado pelo formulário na /payment para coletar dados do estabelecimento
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS responsible text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email_principal text,
  ADD COLUMN IF NOT EXISTS responsible_email text,
  ADD COLUMN IF NOT EXISTS city text;

-- Garante que authenticated pode atualizar essas colunas
GRANT UPDATE (responsible, phone, email_principal, responsible_email, city, name)
  ON public.companies TO authenticated;

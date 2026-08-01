-- ============================================================
-- Garante a existência da empresa de demonstração (slug 'demo').
--
-- O link/QR geral https://.../c/demo resolve a empresa via
-- get_company_public(slug). Se a empresa não existir, a página
-- mostra "Estabelecimento não encontrado" e o onboarding
-- (criação/mapeamento do cliente) nunca roda — por isso o
-- cliente não aparecia na aba Clientes.
--
-- Idempotente: não sobrescreve nada se a empresa já existir.
-- ============================================================

INSERT INTO public.companies (id, name, slug, status, payment_status, welcome_message)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Weaze Demo',
  'demo',
  'ativo',
  'paid',
  'Bem-vindo à demonstração!'
)
ON CONFLICT DO NOTHING;

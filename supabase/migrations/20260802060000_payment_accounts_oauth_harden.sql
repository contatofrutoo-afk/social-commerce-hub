-- ============================================================
-- MÓDULO FINANCEIRO — endurecimento de acesso (defesa em
-- profundidade)
--
-- O Supabase concede privilégios padrão de tabela a `anon` e
-- `authenticated` ao criar tabelas. O RLS já bloqueia leituras/
-- escritas dessas roles (não há policies para elas), mas
-- removemos os grants para que nem mesmo um erro de policy ou
-- um RLS desligado por acidente exponha tokens/estados OAuth.
--
-- Acesso permitido: somente service_role (backend).
--
-- Seguro reexecutar: REVOKE/GRANT idempotentes.
-- ============================================================

-- payment_accounts: anon não precisa de nenhum acesso
-- (authenticated já está restrito a colunas não sensíveis).
REVOKE ALL ON public.payment_accounts FROM anon;
GRANT ALL ON public.payment_accounts TO service_role;

-- payment_oauth_states: tabela interna do fluxo OAuth, só backend.
REVOKE ALL ON public.payment_oauth_states FROM anon, authenticated;
GRANT ALL ON public.payment_oauth_states TO service_role;

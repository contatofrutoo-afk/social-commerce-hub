-- ============================================================
-- FIX: remove ambiguidade do wrapper público auto_checkin.
--
-- Contexto: a migration 20260713164256 criou um OVERLOAD de
-- public.auto_checkin com 6 parâmetros (p_*), delegando para
-- private.auto_checkin_legacy, que grava presença em b2c_customers
-- (tabela legada) e NÃO cria check-in em checkins. Com dois
-- overloads, o PostgREST pode resolver para a função errada — e
-- o cliente deixa de aparecer na seção Loja/Mesas do Atendimento.
--
-- Correção: remove o overload legado e a função privada legada,
-- mantendo apenas public.auto_checkin(uuid, uuid, uuid, uuid, text)
-- (5 args _*) que delega para private.auto_checkin — a versão
-- moderna que cria check-in com remap de Loja/Mesa.
-- Idempotente: pode ser executado quantas vezes for necessário.
-- ============================================================

-- 1) Remover o overload público legado (6 args p_*)
DROP FUNCTION IF EXISTS public.auto_checkin(uuid, uuid, text, text, text, text);

-- 2) Remover a função privada legada
DROP FUNCTION IF EXISTS private.auto_checkin_legacy(uuid, uuid, text, text, text, text);

-- 3) Garantir o wrapper público moderno (5 args _*) — idempotente
CREATE OR REPLACE FUNCTION public.auto_checkin(
  _customer_id uuid,
  _token uuid,
  _company_id uuid,
  _table_id uuid DEFAULT NULL,
  _source text DEFAULT 'link'
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.auto_checkin(_customer_id, _token, _company_id, _table_id, _source);
$$;

REVOKE ALL ON FUNCTION public.auto_checkin(uuid, uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_checkin(uuid, uuid, uuid, uuid, text) TO anon, authenticated;

-- ============================================================
-- VERIFICAÇÃO (rodar depois de aplicar o script):
--
-- SELECT p.proname,
--        pg_get_function_arguments(p.oid) AS args
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'auto_checkin';
-- -- Esperado: apenas 1 linha com 5 argumentos (uuid, uuid, uuid, uuid, text)
-- ============================================================

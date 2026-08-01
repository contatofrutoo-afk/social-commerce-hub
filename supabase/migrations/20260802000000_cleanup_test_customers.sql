
-- ============================================================
-- LIMPEZA de artefatos de teste criados durante verificações em
-- produção (2026-08-01/02). Remove apenas linhas que não são
-- clientes reais:
--   - whatsapp LIKE 'removido-%' : clientes anonimizados pelo
--     "Excluir meus dados" (nome = 'Usuário removido'). A linha
--     original já foi anonimizada (LGPD); manter a linha visível
--     na aba Clientes só polui a lista com "Usuário removido".
--   - whatsapp LIKE 'verif-%'    : linhas criadas por testes manuais.
-- Idempotente: DELETE é naturalmente idempotente.
-- ============================================================

-- Remove os registros-filhos ANTES do cliente (não depende de
-- ON DELETE CASCADE). Tabelas com chave composta (post_id/product_id,
-- customer_id) apenas descartam os repetidos aqui.
DELETE FROM public.post_reactions WHERE customer_id IN (SELECT id FROM public.customers WHERE whatsapp LIKE 'removido-%' OR whatsapp LIKE 'verif-%');
DELETE FROM public.product_likes   WHERE customer_id IN (SELECT id FROM public.customers WHERE whatsapp LIKE 'removido-%' OR whatsapp LIKE 'verif-%');
DELETE FROM public.product_wishes  WHERE customer_id IN (SELECT id FROM public.customers WHERE whatsapp LIKE 'removido-%' OR whatsapp LIKE 'verif-%');
DELETE FROM public.product_events  WHERE customer_id IN (SELECT id FROM public.customers WHERE whatsapp LIKE 'removido-%' OR whatsapp LIKE 'verif-%');
DELETE FROM public.consent_log     WHERE customer_id IN (SELECT id FROM public.customers WHERE whatsapp LIKE 'removido-%' OR whatsapp LIKE 'verif-%');
DELETE FROM public.comments        WHERE customer_id IN (SELECT id FROM public.customers WHERE whatsapp LIKE 'removido-%' OR whatsapp LIKE 'verif-%');
DELETE FROM public.checkins        WHERE customer_id IN (SELECT id FROM public.customers WHERE whatsapp LIKE 'removido-%' OR whatsapp LIKE 'verif-%');

DELETE FROM public.order_items WHERE order_id IN (
  SELECT o.id FROM public.orders o
  JOIN public.customers c ON c.id = o.customer_id
  WHERE c.whatsapp LIKE 'removido-%' OR c.whatsapp LIKE 'verif-%'
);
DELETE FROM public.orders WHERE customer_id IN (SELECT id FROM public.customers WHERE whatsapp LIKE 'removido-%' OR whatsapp LIKE 'verif-%');

DELETE FROM public.post_products WHERE post_id IN (
  SELECT p.id FROM public.posts p
  JOIN public.customers c ON c.id = p.customer_id
  WHERE c.whatsapp LIKE 'removido-%' OR c.whatsapp LIKE 'verif-%'
);
DELETE FROM public.posts WHERE customer_id IN (SELECT id FROM public.customers WHERE whatsapp LIKE 'removido-%' OR whatsapp LIKE 'verif-%');

DELETE FROM public.customers WHERE whatsapp LIKE 'removido-%' OR whatsapp LIKE 'verif-%';

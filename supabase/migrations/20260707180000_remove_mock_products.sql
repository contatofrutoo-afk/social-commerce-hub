
-- Remove todos os produtos mockados/seed do banco
-- A criação de empresa via claim_own_company já não insere produtos,
-- então novos cadastros começam limpos automaticamente.
DELETE FROM public.product_wishes;
DELETE FROM public.product_likes;
DELETE FROM public.post_products;
DELETE FROM public.order_items;
DELETE FROM public.orders;
DELETE FROM public.products;

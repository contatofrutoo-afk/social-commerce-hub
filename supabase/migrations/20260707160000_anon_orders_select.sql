
-- Restore SELECT on orders + order_items for anon (revogadas em 20260706001131).
-- Necessário para orderRepository.create() (.insert().select()) e
-- orderRepository.listByCustomer() (exibição de pedidos no perfil).
GRANT SELECT ON public.orders TO anon;
GRANT SELECT ON public.order_items TO anon;

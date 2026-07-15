
ALTER PUBLICATION supabase_realtime ADD TABLE public.checkins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;

ALTER TABLE public.checkins REPLICA IDENTITY FULL;
ALTER TABLE public.tables REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.customers REPLICA IDENTITY FULL;

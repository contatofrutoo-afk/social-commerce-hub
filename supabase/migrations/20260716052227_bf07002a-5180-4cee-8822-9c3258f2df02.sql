
-- Comments: filtered by post_id in feed reads (5595 seq scans observed)
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON public.comments (post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_customer ON public.comments (customer_id);

-- Order items: joined by product_id
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items (product_id);

-- Orders: lookups by customer
CREATE INDEX IF NOT EXISTS idx_orders_customer_created ON public.orders (customer_id, created_at DESC);

-- Post reactions: reverse lookup by customer
CREATE INDEX IF NOT EXISTS idx_post_reactions_customer ON public.post_reactions (customer_id);

-- Product joins on the many-side
CREATE INDEX IF NOT EXISTS idx_post_products_product ON public.post_products (product_id);
CREATE INDEX IF NOT EXISTS idx_product_likes_customer ON public.product_likes (customer_id);
CREATE INDEX IF NOT EXISTS idx_product_wishes_customer ON public.product_wishes (customer_id);

-- Checkins: filter by table
CREATE INDEX IF NOT EXISTS idx_checkins_table ON public.checkins (table_id) WHERE table_id IS NOT NULL;

-- Products: catalogue browsing ordered by created_at within company
CREATE INDEX IF NOT EXISTS idx_products_company_created ON public.products (company_id, created_at DESC);

-- User roles: role lookups per user (auth checks run constantly)
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_company ON public.user_roles (company_id) WHERE company_id IS NOT NULL;

-- Companies status filters used in admin dashboards
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies (status);

-- Product events analytics: (company_id, created_at DESC) covers dashboards
CREATE INDEX IF NOT EXISTS idx_product_events_company_created ON public.product_events (company_id, created_at DESC);

-- Refresh planner statistics
ANALYZE public.comments;
ANALYZE public.order_items;
ANALYZE public.orders;
ANALYZE public.post_reactions;
ANALYZE public.post_products;
ANALYZE public.product_likes;
ANALYZE public.product_wishes;
ANALYZE public.checkins;
ANALYZE public.products;
ANALYZE public.user_roles;
ANALYZE public.companies;
ANALYZE public.product_events;


-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.visit_context AS ENUM ('sozinho','casal','amigos','familia');
CREATE TYPE public.post_author_type AS ENUM ('business','customer');
CREATE TYPE public.reaction_type AS ENUM ('love','dislike');
CREATE TYPE public.order_status AS ENUM ('received','completed');
CREATE TYPE public.app_role AS ENUM ('owner','staff');

-- =========================
-- COMPANIES
-- =========================
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  primary_color text DEFAULT '#8800AA',
  welcome_message text DEFAULT 'Bem-vindo!',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.companies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Companies are readable by everyone" ON public.companies FOR SELECT USING (true);

-- =========================
-- USER ROLES (per company)
-- =========================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_company_access(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND company_id = _company_id)
$$;

CREATE OR REPLACE FUNCTION public.current_user_company()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

-- =========================
-- TABLES (mesas)
-- =========================
CREATE TABLE public.tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, slug)
);
GRANT SELECT ON public.tables TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tables TO authenticated;
GRANT ALL ON public.tables TO service_role;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tables readable by everyone" ON public.tables FOR SELECT USING (true);
CREATE POLICY "Company members manage tables" ON public.tables FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- =========================
-- CUSTOMERS (B2C)
-- =========================
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  whatsapp text NOT NULL,
  avatar_url text,
  first_visit_at timestamptz NOT NULL DEFAULT now(),
  last_visit_at timestamptz NOT NULL DEFAULT now(),
  visit_count int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, whatsapp)
);
GRANT SELECT, INSERT, UPDATE ON public.customers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
-- Público pode criar / atualizar próprio registro (identificação por whatsapp+company). Leitura pública somente do próprio registro seria ideal mas simplificando MVP:
CREATE POLICY "Customers readable by anyone" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Anyone can register as customer" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update customer" ON public.customers FOR UPDATE USING (true) WITH CHECK (true);

-- =========================
-- CHECKINS
-- =========================
CREATE TABLE public.checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  context public.visit_context NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.checkins TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkins TO authenticated;
GRANT ALL ON public.checkins TO service_role;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Checkins readable" ON public.checkins FOR SELECT USING (true);
CREATE POLICY "Anyone can create checkin" ON public.checkins FOR INSERT WITH CHECK (true);

-- =========================
-- PRODUCTS
-- =========================
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  available boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products readable" ON public.products FOR SELECT USING (true);
CREATE POLICY "Company members manage products" ON public.products FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- =========================
-- POSTS (feed)
-- =========================
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  author_type public.post_author_type NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  image_url text,
  video_url text,
  text text,
  category text,
  companions public.visit_context,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts readable" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Anyone customer can post" ON public.posts FOR INSERT WITH CHECK (author_type = 'customer' AND customer_id IS NOT NULL);
CREATE POLICY "Company members manage posts" ON public.posts FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- =========================
-- POST PRODUCTS
-- =========================
CREATE TABLE public.post_products (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, product_id)
);
GRANT SELECT ON public.post_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_products TO authenticated;
GRANT ALL ON public.post_products TO service_role;
ALTER TABLE public.post_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Post-products readable" ON public.post_products FOR SELECT USING (true);
CREATE POLICY "Auth manages post-products" ON public.post_products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================
-- POST REACTIONS
-- =========================
CREATE TABLE public.post_reactions (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  type public.reaction_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, customer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_reactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_reactions TO authenticated;
GRANT ALL ON public.post_reactions TO service_role;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reactions readable" ON public.post_reactions FOR SELECT USING (true);
CREATE POLICY "Anyone can react" ON public.post_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update reaction" ON public.post_reactions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can remove reaction" ON public.post_reactions FOR DELETE USING (true);

-- =========================
-- COMMENTS
-- =========================
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  text text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments readable" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Anyone can comment" ON public.comments FOR INSERT WITH CHECK (true);

-- =========================
-- PRODUCT LIKES / WISHES
-- =========================
CREATE TABLE public.product_likes (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, customer_id)
);
GRANT SELECT, INSERT, DELETE ON public.product_likes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_likes TO authenticated;
GRANT ALL ON public.product_likes TO service_role;
ALTER TABLE public.product_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes readable" ON public.product_likes FOR SELECT USING (true);
CREATE POLICY "Anyone can like" ON public.product_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can unlike" ON public.product_likes FOR DELETE USING (true);

CREATE TABLE public.product_wishes (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, customer_id)
);
GRANT SELECT, INSERT, DELETE ON public.product_wishes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_wishes TO authenticated;
GRANT ALL ON public.product_wishes TO service_role;
ALTER TABLE public.product_wishes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Wishes readable" ON public.product_wishes FOR SELECT USING (true);
CREATE POLICY "Anyone can wish" ON public.product_wishes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can unwish" ON public.product_wishes FOR DELETE USING (true);

-- =========================
-- ORDERS
-- =========================
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  status public.order_status NOT NULL DEFAULT 'received',
  total numeric(10,2) NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Orders readable" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Anyone can create order" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Company members manage orders" ON public.orders FOR ALL TO authenticated
  USING (public.has_company_access(auth.uid(), company_id))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity int NOT NULL DEFAULT 1,
  note text,
  unit_price numeric(10,2) NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT ON public.order_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order items readable" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Anyone can create order item" ON public.order_items FOR INSERT WITH CHECK (true);

-- =========================
-- INDEXES
-- =========================
CREATE INDEX idx_customers_company ON public.customers(company_id);
CREATE INDEX idx_checkins_company_created ON public.checkins(company_id, created_at DESC);
CREATE INDEX idx_checkins_customer ON public.checkins(customer_id);
CREATE INDEX idx_posts_company_created ON public.posts(company_id, created_at DESC);
CREATE INDEX idx_products_company ON public.products(company_id);
CREATE INDEX idx_orders_company_created ON public.orders(company_id, created_at DESC);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

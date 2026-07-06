
-- 1. checkins: remove permissive anon SELECT and tighten INSERT
DROP POLICY IF EXISTS "Anyone can read own checkin" ON public.checkins;
DROP POLICY IF EXISTS "Anyone can create checkin" ON public.checkins;
CREATE POLICY "Anyone can create checkin"
  ON public.checkins FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = checkins.company_id));

-- 2. customers table hardening
DROP POLICY IF EXISTS "Anyone can update customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can read customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can register as customer" ON public.customers;

-- Business (authenticated) can fully read/update customers of their company
CREATE POLICY "Company members read customers"
  ON public.customers FOR SELECT TO authenticated
  USING (private.has_company_access(auth.uid(), company_id));
CREATE POLICY "Company members update customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (private.has_company_access(auth.uid(), company_id))
  WITH CHECK (private.has_company_access(auth.uid(), company_id));

-- Public feed embeds customer name only; anon may read rows but only via column grants below.
CREATE POLICY "Public read customer profile"
  ON public.customers FOR SELECT TO anon
  USING (true);

-- Column-level restriction: anon cannot see whatsapp or visit metrics
REVOKE SELECT ON public.customers FROM anon;
GRANT SELECT (id, company_id, name, avatar_url) ON public.customers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

-- Session token to authorize customer-side mutations
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS session_token uuid NOT NULL DEFAULT gen_random_uuid();

-- Helper: verify a customer session
CREATE OR REPLACE FUNCTION private.verify_customer(_customer_id uuid, _token uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = _customer_id AND session_token = _token
  );
$$;

-- Anon-callable RPC: upsert customer + return session token
CREATE OR REPLACE FUNCTION public.upsert_customer_visit(
  _company_id uuid, _name text, _whatsapp text
) RETURNS TABLE(customer_id uuid, session_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid; v_token uuid;
BEGIN
  IF _name IS NULL OR length(btrim(_name)) = 0 THEN RAISE EXCEPTION 'name required'; END IF;
  IF _whatsapp IS NULL OR length(btrim(_whatsapp)) = 0 THEN RAISE EXCEPTION 'whatsapp required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id) THEN
    RAISE EXCEPTION 'invalid company';
  END IF;
  SELECT c.id, c.session_token INTO v_id, v_token
    FROM public.customers c
    WHERE c.company_id = _company_id AND c.whatsapp = _whatsapp;
  IF v_id IS NULL THEN
    INSERT INTO public.customers (company_id, name, whatsapp)
    VALUES (_company_id, _name, _whatsapp)
    RETURNING id, public.customers.session_token INTO v_id, v_token;
  ELSE
    UPDATE public.customers
      SET name = _name,
          last_visit_at = now(),
          visit_count = COALESCE(visit_count, 0) + 1
      WHERE id = v_id;
  END IF;
  RETURN QUERY SELECT v_id, v_token;
END;
$$;
GRANT EXECUTE ON FUNCTION public.upsert_customer_visit(uuid, text, text) TO anon, authenticated;

-- Anon-callable RPC: read own full profile (incl. whatsapp) via token
CREATE OR REPLACE FUNCTION public.get_customer_self(_customer_id uuid, _token uuid)
RETURNS SETOF public.customers
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY SELECT * FROM public.customers WHERE id = _customer_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_customer_self(uuid, uuid) TO anon, authenticated;

-- Anon-callable RPC: update own profile
CREATE OR REPLACE FUNCTION public.update_customer_self(
  _customer_id uuid, _token uuid, _name text, _whatsapp text, _avatar_url text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public.customers
    SET name = COALESCE(_name, name),
        whatsapp = COALESCE(_whatsapp, whatsapp),
        avatar_url = _avatar_url
    WHERE id = _customer_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_customer_self(uuid, uuid, text, text, text) TO anon, authenticated;

-- 3. Post reactions / product likes / product wishes: drop permissive policies, gate via RPCs
DROP POLICY IF EXISTS "Reactions owner delete" ON public.post_reactions;
DROP POLICY IF EXISTS "Reactions owner update" ON public.post_reactions;
DROP POLICY IF EXISTS "Anyone can react" ON public.post_reactions;

DROP POLICY IF EXISTS "Likes owner delete" ON public.product_likes;
DROP POLICY IF EXISTS "Anyone can like" ON public.product_likes;

DROP POLICY IF EXISTS "Wishes owner delete" ON public.product_wishes;
DROP POLICY IF EXISTS "Anyone can wish" ON public.product_wishes;

CREATE OR REPLACE FUNCTION public.set_post_reaction(
  _customer_id uuid, _token uuid, _post_id uuid, _type text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _type IS NULL THEN
    DELETE FROM public.post_reactions WHERE post_id = _post_id AND customer_id = _customer_id;
    RETURN;
  END IF;
  IF _type NOT IN ('love','dislike') THEN RAISE EXCEPTION 'invalid type'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.posts p JOIN public.customers c ON c.id = _customer_id
    WHERE p.id = _post_id AND c.company_id = p.company_id
  ) THEN RAISE EXCEPTION 'company mismatch'; END IF;
  INSERT INTO public.post_reactions (post_id, customer_id, type)
    VALUES (_post_id, _customer_id, _type)
    ON CONFLICT (post_id, customer_id) DO UPDATE SET type = EXCLUDED.type;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_post_reaction(uuid, uuid, uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.toggle_product_like(
  _customer_id uuid, _token uuid, _product_id uuid, _liked boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _liked THEN
    DELETE FROM public.product_likes WHERE product_id = _product_id AND customer_id = _customer_id;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.products p JOIN public.customers c ON c.id = _customer_id
      WHERE p.id = _product_id AND c.company_id = p.company_id
    ) THEN RAISE EXCEPTION 'company mismatch'; END IF;
    INSERT INTO public.product_likes (product_id, customer_id)
      VALUES (_product_id, _customer_id) ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_product_like(uuid, uuid, uuid, boolean) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.toggle_product_wish(
  _customer_id uuid, _token uuid, _product_id uuid, _wished boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _wished THEN
    DELETE FROM public.product_wishes WHERE product_id = _product_id AND customer_id = _customer_id;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.products p JOIN public.customers c ON c.id = _customer_id
      WHERE p.id = _product_id AND c.company_id = p.company_id
    ) THEN RAISE EXCEPTION 'company mismatch'; END IF;
    INSERT INTO public.product_wishes (product_id, customer_id)
      VALUES (_product_id, _customer_id) ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_product_wish(uuid, uuid, uuid, boolean) TO anon, authenticated;

-- 4. Storage: uploads must land under the caller's company folder
DROP POLICY IF EXISTS "Authenticated upload" ON storage.objects;
CREATE POLICY "Authenticated upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'weaze-media'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM public.user_roles WHERE user_id = auth.uid()
    )
  );


-- 1. Drop permissive anon INSERT policies
DROP POLICY IF EXISTS "Anyone can create checkin" ON public.checkins;
DROP POLICY IF EXISTS "Anyone can comment" ON public.comments;
DROP POLICY IF EXISTS "Anyone can create order item" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can create order" ON public.orders;
DROP POLICY IF EXISTS "Anyone customer can post" ON public.posts;

-- 2. Restrict product_likes / product_wishes SELECT to company staff
DROP POLICY IF EXISTS "Likes readable" ON public.product_likes;
DROP POLICY IF EXISTS "Wishes readable" ON public.product_wishes;

CREATE POLICY "Company staff read likes" ON public.product_likes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_likes.product_id
      AND private.has_company_access(auth.uid(), p.company_id)
  ));

CREATE POLICY "Company staff read wishes" ON public.product_wishes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_wishes.product_id
      AND private.has_company_access(auth.uid(), p.company_id)
  ));

-- Revoke anon access
REVOKE SELECT ON public.product_likes FROM anon;
REVOKE SELECT ON public.product_wishes FROM anon;

-- 3. Secure RPC to create a customer post (session-token verified)
CREATE OR REPLACE FUNCTION private.create_customer_post(
  _customer_id uuid,
  _token uuid,
  _company_id uuid,
  _text text,
  _image_url text,
  _category text,
  _companions text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_id uuid;
  cust_company uuid;
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  SELECT company_id INTO cust_company FROM public.customers WHERE id = _customer_id;
  IF cust_company IS NULL OR cust_company <> _company_id THEN
    RAISE EXCEPTION 'customer/company mismatch';
  END IF;

  INSERT INTO public.posts (company_id, author_type, customer_id, text, image_url, category, companions)
  VALUES (_company_id, 'customer', _customer_id, _text, _image_url, _category,
          NULLIF(_companions, '')::visit_context)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_customer_post(
  _customer_id uuid, _token uuid, _company_id uuid,
  _text text, _image_url text, _category text, _companions text
) RETURNS uuid LANGUAGE sql SET search_path = public AS $$
  SELECT private.create_customer_post(_customer_id, _token, _company_id, _text, _image_url, _category, _companions);
$$;

REVOKE ALL ON FUNCTION public.create_customer_post(uuid, uuid, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_post(uuid, uuid, uuid, text, text, text, text) TO anon, authenticated;

-- 4. Secure RPC to create a comment (session-token verified)
CREATE OR REPLACE FUNCTION private.create_customer_comment(
  _customer_id uuid,
  _token uuid,
  _post_id uuid,
  _text text,
  _image_url text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_id uuid;
  post_company uuid;
  cust_company uuid;
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  SELECT company_id INTO post_company FROM public.posts WHERE id = _post_id;
  SELECT company_id INTO cust_company FROM public.customers WHERE id = _customer_id;
  IF post_company IS NULL OR post_company <> cust_company THEN
    RAISE EXCEPTION 'post/customer mismatch';
  END IF;

  INSERT INTO public.comments (post_id, customer_id, text, image_url)
  VALUES (_post_id, _customer_id, _text, _image_url)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_customer_comment(
  _customer_id uuid, _token uuid, _post_id uuid, _text text, _image_url text
) RETURNS uuid LANGUAGE sql SET search_path = public AS $$
  SELECT private.create_customer_comment(_customer_id, _token, _post_id, _text, _image_url);
$$;

REVOKE ALL ON FUNCTION public.create_customer_comment(uuid, uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_comment(uuid, uuid, uuid, text, text) TO anon, authenticated;

-- 5. Storage policies: tighten anon uploads and restrict public read to known folders
DROP POLICY IF EXISTS "Anon can upload publish photos" ON storage.objects;
DROP POLICY IF EXISTS "Anon can upload comment photos" ON storage.objects;
DROP POLICY IF EXISTS "Anon can upload feed photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read" ON storage.objects;

-- Narrow public read: still public URL accessible, but only for known folders
CREATE POLICY "Public read weaze-media folders" ON storage.objects
  FOR SELECT TO public
  USING (
    bucket_id = 'weaze-media'
    AND (storage.foldername(name))[1] IN ('avatars','comments','feed','publicar','products','posts','logos','general','business')
  );

-- Anon uploads to publicar/{customer_id}/... require existing customer
CREATE POLICY "Anon upload publicar with customer" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'weaze-media'
    AND (storage.foldername(name))[1] = 'publicar'
    AND (storage.foldername(name))[2] IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id::text = (storage.foldername(name))[2]
    )
  );

CREATE POLICY "Anon upload comments with customer" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'weaze-media'
    AND (storage.foldername(name))[1] = 'comments'
    AND (storage.foldername(name))[2] IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id::text = (storage.foldername(name))[2]
    )
  );

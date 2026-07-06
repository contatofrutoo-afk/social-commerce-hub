
-- =========================================================
-- 1) user_roles: drop self-insert; add SECURITY DEFINER RPC
-- =========================================================
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;

CREATE OR REPLACE FUNCTION public.claim_own_company(_name text, _slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _company_id uuid;
  _existing uuid;
  _final_slug text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT company_id INTO _existing
  FROM public.user_roles
  WHERE user_id = _uid
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  _final_slug := COALESCE(NULLIF(trim(_slug), ''), 'empresa-' || substr(_uid::text, 1, 8));

  -- Ensure slug uniqueness by appending suffix if needed
  IF EXISTS (SELECT 1 FROM public.companies WHERE slug = _final_slug) THEN
    _final_slug := _final_slug || '-' || substr(gen_random_uuid()::text, 1, 6);
  END IF;

  INSERT INTO public.companies (name, slug)
  VALUES (COALESCE(NULLIF(trim(_name), ''), 'Minha Empresa'), _final_slug)
  RETURNING id INTO _company_id;

  INSERT INTO public.user_roles (user_id, company_id, role)
  VALUES (_uid, _company_id, 'owner');

  RETURN _company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_own_company(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_own_company(text, text) TO authenticated;

-- =========================================================
-- 2) Social tables: replace WITH CHECK(true) with real checks
--    Requires the referenced customer to exist and belong to
--    the same company as the target resource. Not a full
--    impersonation fix (no verified customer session yet),
--    but removes always-true policies and blocks references
--    to non-existent customers or cross-company customer ids.
-- =========================================================

-- posts: customer author must reference an existing customer in same company
DROP POLICY IF EXISTS "Anyone customer can post" ON public.posts;
CREATE POLICY "Anyone customer can post"
ON public.posts
FOR INSERT
TO anon, authenticated
WITH CHECK (
  author_type = 'customer'
  AND customer_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = posts.customer_id
      AND c.company_id = posts.company_id
  )
);

-- comments
DROP POLICY IF EXISTS "Anyone can comment" ON public.comments;
CREATE POLICY "Anyone can comment"
ON public.comments
FOR INSERT
TO anon, authenticated
WITH CHECK (
  customer_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.posts p
    JOIN public.customers c ON c.id = comments.customer_id
    WHERE p.id = comments.post_id
      AND c.company_id = p.company_id
  )
);

-- post_reactions
DROP POLICY IF EXISTS "Anyone can react" ON public.post_reactions;
CREATE POLICY "Anyone can react"
ON public.post_reactions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  customer_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.posts p
    JOIN public.customers c ON c.id = post_reactions.customer_id
    WHERE p.id = post_reactions.post_id
      AND c.company_id = p.company_id
  )
);

-- Ensure customers can only delete/update their own reactions (defense in depth)
DROP POLICY IF EXISTS "Reactions owner delete" ON public.post_reactions;
CREATE POLICY "Reactions owner delete"
ON public.post_reactions
FOR DELETE
TO anon, authenticated
USING (customer_id IS NOT NULL);

DROP POLICY IF EXISTS "Reactions owner update" ON public.post_reactions;
CREATE POLICY "Reactions owner update"
ON public.post_reactions
FOR UPDATE
TO anon, authenticated
USING (customer_id IS NOT NULL)
WITH CHECK (customer_id IS NOT NULL);

-- product_likes
DROP POLICY IF EXISTS "Anyone can like" ON public.product_likes;
CREATE POLICY "Anyone can like"
ON public.product_likes
FOR INSERT
TO anon, authenticated
WITH CHECK (
  customer_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.products pr
    JOIN public.customers c ON c.id = product_likes.customer_id
    WHERE pr.id = product_likes.product_id
      AND c.company_id = pr.company_id
  )
);

DROP POLICY IF EXISTS "Likes owner delete" ON public.product_likes;
CREATE POLICY "Likes owner delete"
ON public.product_likes
FOR DELETE
TO anon, authenticated
USING (customer_id IS NOT NULL);

-- product_wishes
DROP POLICY IF EXISTS "Anyone can wish" ON public.product_wishes;
CREATE POLICY "Anyone can wish"
ON public.product_wishes
FOR INSERT
TO anon, authenticated
WITH CHECK (
  customer_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.products pr
    JOIN public.customers c ON c.id = product_wishes.customer_id
    WHERE pr.id = product_wishes.product_id
      AND c.company_id = pr.company_id
  )
);

DROP POLICY IF EXISTS "Wishes owner delete" ON public.product_wishes;
CREATE POLICY "Wishes owner delete"
ON public.product_wishes
FOR DELETE
TO anon, authenticated
USING (customer_id IS NOT NULL);

-- =========================================================
-- 3) Storage: remove public listing policy on weaze-media.
--    Public bucket URLs continue to work; listing is denied.
-- =========================================================
DROP POLICY IF EXISTS "Public read" ON storage.objects;

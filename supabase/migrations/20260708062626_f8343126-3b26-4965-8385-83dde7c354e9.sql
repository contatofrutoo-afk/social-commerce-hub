
-- Lock down direct public SELECT on customer-linked tables.
-- All public consumers go through SECURITY DEFINER RPCs
-- (list_public_posts / list_public_comments) which already
-- project safe columns.

DROP POLICY IF EXISTS "Posts readable" ON public.posts;
DROP POLICY IF EXISTS "Comments readable" ON public.comments;
DROP POLICY IF EXISTS "Reactions readable" ON public.post_reactions;
DROP POLICY IF EXISTS "Products readable" ON public.products;
DROP POLICY IF EXISTS "Post-products readable" ON public.post_products;

-- Company staff can still read their own rows for dashboards / CRM.
CREATE POLICY "Company members read posts"
  ON public.posts FOR SELECT
  TO authenticated
  USING (private.has_company_access(auth.uid(), company_id));

CREATE POLICY "Company members read comments"
  ON public.comments FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = comments.post_id
      AND private.has_company_access(auth.uid(), p.company_id)
  ));

CREATE POLICY "Company members read reactions"
  ON public.post_reactions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_reactions.post_id
      AND private.has_company_access(auth.uid(), p.company_id)
  ));

CREATE POLICY "Company members read products"
  ON public.products FOR SELECT
  TO authenticated
  USING (private.has_company_access(auth.uid(), company_id));

CREATE POLICY "Company members read post-products"
  ON public.post_products FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_products.post_id
      AND private.has_company_access(auth.uid(), p.company_id)
  ));

-- Revoke direct anon Data API access; RPCs remain callable.
REVOKE SELECT ON public.posts FROM anon;
REVOKE SELECT ON public.comments FROM anon;
REVOKE SELECT ON public.post_reactions FROM anon;
REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.post_products FROM anon;

-- Narrow storage public listing to genuinely public content folders.
DROP POLICY IF EXISTS "Public read weaze-media folders" ON storage.objects;

CREATE POLICY "Public read weaze-media public folders"
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id = 'weaze-media'
    AND (storage.foldername(name))[1] = ANY (
      ARRAY['logos','business','posts','products','feed','publicar']
    )
  );

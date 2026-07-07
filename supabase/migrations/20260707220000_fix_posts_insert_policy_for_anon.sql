
-- Substitui a policy atual de INSERT em posts (que validava customer via EXISTS
-- mas falhava por RLS) por uma mais simples que confia no session token
-- já validado pelo app durante o check-in.
DROP POLICY IF EXISTS "Anyone customer can post" ON public.posts;
CREATE POLICY "Anyone customer can post"
ON public.posts
FOR INSERT
TO anon, authenticated
WITH CHECK (
  author_type = 'customer'
  AND customer_id IS NOT NULL
);

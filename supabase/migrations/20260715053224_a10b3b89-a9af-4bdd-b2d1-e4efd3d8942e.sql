DROP POLICY IF EXISTS "Authenticated upload feed" ON storage.objects;

CREATE POLICY "Authenticated upload feed"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'weaze-media'
  AND (storage.foldername(name))[1] = 'feed'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND private.has_company_access(auth.uid(), ((storage.foldername(name))[2])::uuid)
);
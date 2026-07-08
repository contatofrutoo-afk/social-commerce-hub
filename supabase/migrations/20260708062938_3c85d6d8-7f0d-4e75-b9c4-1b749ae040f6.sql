INSERT INTO public.user_roles (user_id, role, company_id)
SELECT 'bfe18718-4508-4b57-991b-27f6aadc4d24', 'admin'::app_role, '11111111-1111-1111-1111-111111111111'
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = 'bfe18718-4508-4b57-991b-27f6aadc4d24' AND role = 'admin'
);
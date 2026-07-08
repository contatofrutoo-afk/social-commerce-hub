-- ============================================================
-- Fix: garante que 'admin' existe no enum e que has_role é
-- SECURITY DEFINER (era SECURITY INVOKER, o que podia falhar
-- dependendo das permissões do caller).
-- ============================================================

-- 1. Garante que 'admin' existe no enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

-- 2. Remove policies que dependem da função has_role
DROP POLICY IF EXISTS "Admins can view admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admins can insert admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admins can update admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admins can delete admin_settings" ON public.admin_settings;

-- 3. Recreate public.has_role como SECURITY DEFINER
--    (a versão anterior em 20260708061236 mudou para SECURITY
--     INVOKER, o que quebrava a chamada via supabase.rpc()
--     quando o usuário authenticated não tinha permissões
--     suficientes no schema privado).
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. Garante que authenticated pode executar a função
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 5. Recria as policies que usam has_role
CREATE POLICY "Admins can view admin_settings"
ON public.admin_settings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert admin_settings"
ON public.admin_settings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update admin_settings"
ON public.admin_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete admin_settings"
ON public.admin_settings FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

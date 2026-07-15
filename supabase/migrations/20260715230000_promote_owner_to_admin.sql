-- ============================================================
-- WEAZE ADMIN — Promover owner para admin
-- Execute este SQL no Editor SQL do Supabase
-- ============================================================

-- 1. Garante que 'admin' existe no enum app_role
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Promove todos os owners para admin (quem criou empresa é o admin)
UPDATE public.user_roles
SET role = 'admin'
WHERE role = 'owner';

-- 3. Garante que has_role existe como SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 4. Garante que authenticated pode ler user_roles (necessário para o painel admin)
GRANT SELECT ON public.user_roles TO authenticated;

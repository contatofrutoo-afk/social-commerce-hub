-- ============================================================
-- WEAZE ADMIN — Fix completo (idempotente, seguro para rodar varias vezes)
-- Execute no Editor SQL do Supabase
-- ============================================================

-- 1. Garante que 'admin' existe no enum
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Remove funcao antiga com assinatura errada, se existir
DROP FUNCTION IF EXISTS public.has_role(text, public.app_role);
DROP FUNCTION IF EXISTS public.has_role(uuid, text);

-- 3. Cria has_role como SECURITY DEFINER
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

-- 4. Garante SELECT em user_roles
GRANT SELECT ON public.user_roles TO authenticated;

-- 5. Verifica qual role voce tem agora
SELECT user_id, role, company_id FROM public.user_roles WHERE user_id = auth.uid();

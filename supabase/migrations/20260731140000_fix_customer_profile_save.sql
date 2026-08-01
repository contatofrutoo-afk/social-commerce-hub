-- ============================================================
-- FIX: salvar Perfil do cliente (aba Perfil B2C).
--
-- Garante as colunas de perfil e recria a RPC update_customer_self
-- com a assinatura usada pelo frontend (7 parâmetros, incluindo
-- gender/age_range). Idempotente: pode ser executado quantas
-- vezes for necessário no SQL Editor.
-- ============================================================

-- 1) Garantir colunas de perfil na tabela customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS age_range text;

-- 2) Garantir colunas de consentimento (LGPD)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS accepted_terms_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_privacy_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_checkin_privacy_at timestamptz;

-- 3) Recriar private.update_customer_self (remove overloads antigas)
DROP FUNCTION IF EXISTS private.update_customer_self(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS private.update_customer_self(uuid, uuid, text, text, text, text, text);

CREATE OR REPLACE FUNCTION private.update_customer_self(
  _customer_id uuid,
  _token uuid,
  _name text,
  _whatsapp text,
  _avatar_url text,
  _gender text DEFAULT NULL,
  _age_range text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.customers
  SET name = COALESCE(NULLIF(btrim(COALESCE(_name, '')), ''), name),
      whatsapp = COALESCE(NULLIF(btrim(COALESCE(_whatsapp, '')), ''), whatsapp),
      avatar_url = CASE WHEN btrim(COALESCE(_avatar_url, '')) = '' THEN avatar_url ELSE _avatar_url END,
      gender = _gender,
      age_range = _age_range
  WHERE id = _customer_id;
END;
$$;

-- 4) Recriar wrapper público (assinatura de 7 parâmetros)
DROP FUNCTION IF EXISTS public.update_customer_self(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.update_customer_self(uuid, uuid, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.update_customer_self(
  _customer_id uuid,
  _token uuid,
  _name text,
  _whatsapp text,
  _avatar_url text,
  _gender text DEFAULT NULL,
  _age_range text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.update_customer_self(_customer_id, _token, _name, _whatsapp, _avatar_url, _gender, _age_range);
$$;

REVOKE ALL ON FUNCTION public.update_customer_self(uuid, uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_customer_self(uuid, uuid, text, text, text, text, text) TO anon, authenticated;

-- 5) Ajustar CHECK de consent_log para os tipos usados pela aba Perfil
--    ('terms' e 'privacy' enviados pelo botão "Atualizar consentimentos")
ALTER TABLE public.consent_log DROP CONSTRAINT IF EXISTS consent_log_consent_type_check;
ALTER TABLE public.consent_log
  ADD CONSTRAINT consent_log_consent_type_check
  CHECK (consent_type IN ('terms_of_use', 'privacy_policy', 'checkin_privacy', 'profile_completion', 'data_deletion', 'terms', 'privacy'));

-- ============================================================
-- VERIFICAÇÃO (rodar depois de aplicar o script):
--
-- SELECT
--   exists(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--          WHERE n.nspname = 'public'
--            AND p.proname = 'update_customer_self'
--            AND p.pronargs = 7) AS update_self_ok,
--   exists(SELECT 1 FROM information_schema.columns
--          WHERE table_schema = 'public' AND table_name = 'customers'
--            AND column_name = 'gender') AS gender_ok,
--   exists(SELECT 1 FROM information_schema.columns
--          WHERE table_schema = 'public' AND table_name = 'customers'
--            AND column_name = 'age_range') AS age_range_ok;
-- ============================================================

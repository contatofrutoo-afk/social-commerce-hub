-- ============================================================
-- PRIVACY COMPLIANCE: consent tracking + privacy improvements
-- ============================================================

-- 1. consent_log table
CREATE TABLE IF NOT EXISTS public.consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('terms_of_use', 'privacy_policy', 'checkin_privacy', 'profile_completion', 'data_deletion')),
  granted boolean NOT NULL DEFAULT true,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

-- Staff can read consent_log for their company
CREATE POLICY "staff_select_consent" ON public.consent_log
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

-- Anon can insert their own consent via RPC only
-- (no direct insert from client)

-- 2. Add consent columns to customers table
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS accepted_terms_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_privacy_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_checkin_privacy_at timestamptz;

-- 3. RPC to log consent (called from client after checkin, with token validation)
CREATE OR REPLACE FUNCTION private.log_consent(
  _customer_id uuid,
  _company_id uuid,
  _token uuid,
  _consent_type text,
  _ip_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO consent_log (customer_id, company_id, consent_type, ip_address)
  VALUES (_customer_id, _company_id, _consent_type, _ip_address)
  RETURNING id INTO v_id;

  -- Update customer timestamps
  IF _consent_type = 'terms_of_use' THEN
    UPDATE customers SET accepted_terms_at = now() WHERE id = _customer_id;
  ELSIF _consent_type = 'privacy_policy' THEN
    UPDATE customers SET accepted_privacy_at = now() WHERE id = _customer_id;
  ELSIF _consent_type = 'checkin_privacy' THEN
    UPDATE customers SET accepted_checkin_privacy_at = now() WHERE id = _customer_id;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_consent(
  _customer_id uuid,
  _token uuid,
  _company_id uuid,
  _consent_type text,
  _ip_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.log_consent(_customer_id, _company_id, _token, _consent_type, _ip_address);
$$;

REVOKE ALL ON FUNCTION public.log_consent(uuid, uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_consent(uuid, uuid, uuid, text, text) TO anon, authenticated;

-- 4. RPC to check if customer has given specific consent (with token validation)
CREATE OR REPLACE FUNCTION private.has_consent(
  _customer_id uuid,
  _token uuid,
  _consent_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM consent_log
  WHERE customer_id = _customer_id
    AND consent_type = _consent_type
    AND granted = true;
  RETURN v_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_consent(
  _customer_id uuid,
  _token uuid,
  _consent_type text
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.has_consent(_customer_id, _token, _consent_type);
$$;

REVOKE ALL ON FUNCTION public.has_consent(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_consent(uuid, uuid, text) TO anon, authenticated;

-- 5. RPC to delete customer's own data (privacy request, with token validation)
CREATE OR REPLACE FUNCTION private.delete_my_data(
  _customer_id uuid,
  _token uuid,
  _company_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Anonymize personal data instead of hard delete
  UPDATE customers
  SET name = 'Usuário removido',
      whatsapp = 'removido',
      avatar_url = NULL,
      gender = NULL,
      age_range = NULL,
      session_token = gen_random_uuid()
  WHERE id = _customer_id AND company_id = _company_id;

  -- Log the deletion consent
  INSERT INTO consent_log (customer_id, company_id, consent_type)
  VALUES (_customer_id, _company_id, 'data_deletion');
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_my_data(
  _customer_id uuid,
  _token uuid,
  _company_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.delete_my_data(_customer_id, _token, _company_id);
$$;

REVOKE ALL ON FUNCTION public.delete_my_data(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_data(uuid, uuid, uuid) TO anon, authenticated;

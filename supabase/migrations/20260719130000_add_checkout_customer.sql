-- ============================================================
-- Checkout de cliente pelo estabelecimento
-- 1. Adiciona coluna checked_out_at na tabela checkins
-- 2. Cria RPC checkout_customer que:
--    - Valida que o staff tem acesso à empresa
--    - Registra o horário de checkout no checkin
--    - Rotaciona o session_token do cliente (invalida sessão)
-- ============================================================

-- 1. Coluna checked_out_at
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS checked_out_at timestamptz;

-- 2. RPC: checkout de cliente pelo staff
CREATE OR REPLACE FUNCTION public.checkout_customer(
  _staff_user_id uuid,
  _company_id uuid,
  _customer_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  checkin_row record;
BEGIN
  -- Valida que o staff tem acesso à empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _staff_user_id AND company_id = _company_id
  ) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  -- Busca o checkin ativo mais recente deste cliente nesta empresa
  SELECT id INTO checkin_row
  FROM public.checkins
  WHERE customer_id = _customer_id
    AND company_id = _company_id
    AND checked_out_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF checkin_row IS NULL THEN
    RAISE EXCEPTION 'no active checkin found';
  END IF;

  -- Registra o horário de checkout
  UPDATE public.checkins
  SET checked_out_at = now()
  WHERE id = checkin_row.id;

  -- Rotaciona o session_token do cliente (invalida sessão no browser)
  UPDATE public.customers
  SET session_token = gen_random_uuid()
  WHERE id = _customer_id;
END;
$$;

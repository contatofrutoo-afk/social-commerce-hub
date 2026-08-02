-- ============================================================
-- Logout do cliente pelo próprio perfil (botão "Sair")
-- 1. Valida que o token pertence ao cliente (verify_customer)
-- 2. Encerra o check-in ativo (checked_out_at) -> a presença
--    some em tempo real no Atendimento Loja, Dashboard e Clientes
-- 3. Rotaciona o session_token (invalida a sessão no servidor;
--    o guard/realtime detecta e desloga outras abas/dispositivos)
-- ============================================================

CREATE OR REPLACE FUNCTION public.customer_logout(
  _customer_id uuid,
  _token uuid,
  _company_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_checkin_id uuid;
BEGIN
  -- Valida token da sessão
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Valida que o cliente pertence à empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = _customer_id AND company_id = _company_id
  ) THEN
    RAISE EXCEPTION 'company mismatch';
  END IF;

  -- Encerra o check-in ativo mais recente desta empresa (se houver)
  SELECT id INTO v_checkin_id
  FROM public.checkins
  WHERE customer_id = _customer_id
    AND company_id = _company_id
    AND checked_out_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_checkin_id IS NOT NULL THEN
    UPDATE public.checkins
    SET checked_out_at = now()
    WHERE id = v_checkin_id;
  END IF;

  -- Invalida a sessão atual (rotaciona o token no servidor)
  UPDATE public.customers
  SET session_token = gen_random_uuid()
  WHERE id = _customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_logout(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_logout(uuid, uuid, uuid) TO anon, authenticated;

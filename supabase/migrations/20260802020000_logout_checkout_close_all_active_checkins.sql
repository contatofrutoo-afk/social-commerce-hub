-- ============================================================
-- FIX: logout (cliente) e checkout (staff) devem encerrar TODOS
-- os check-ins ativos, não apenas o mais recente.
--
-- Contexto: antes do auto_checkin "remapear" a presença (em vez de
-- duplicar), um cliente podia acumular mais de um check-in ativo
-- (dados legados). Ao sair, apenas o mais recente era encerrado e o
-- cliente continuava aparecendo como "presente" no Atendimento Loja,
-- Dashboard e aba Clientes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.customer_logout(
  _customer_id uuid,
  _token uuid,
  _company_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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

  -- Encerra TODOS os check-ins ativos deste cliente nesta empresa
  UPDATE public.checkins
  SET checked_out_at = now()
  WHERE customer_id = _customer_id
    AND company_id = _company_id
    AND checked_out_at IS NULL;

  -- Invalida a sessão atual (rotaciona o token no servidor)
  UPDATE public.customers
  SET session_token = gen_random_uuid()
  WHERE id = _customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_logout(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_logout(uuid, uuid, uuid) TO anon, authenticated;

-- Mesmo fix para o checkout pelo staff
CREATE OR REPLACE FUNCTION public.checkout_customer(
  _staff_user_id uuid,
  _company_id uuid,
  _customer_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Valida que o staff tem acesso à empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _staff_user_id AND company_id = _company_id
  ) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  -- Encerra TODOS os check-ins ativos deste cliente nesta empresa
  UPDATE public.checkins
  SET checked_out_at = now()
  WHERE customer_id = _customer_id
    AND company_id = _company_id
    AND checked_out_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active checkin found';
  END IF;

  -- Rotaciona o session_token do cliente (invalida sessão no browser)
  UPDATE public.customers
  SET session_token = gen_random_uuid()
  WHERE id = _customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_customer(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkout_customer(uuid, uuid, uuid) TO authenticated;

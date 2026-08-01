-- ============================================================
-- Link/QR geral deve mapear o cliente na seção Loja (Atendimento).
--
-- Contexto: no fluxo antigo, o check-in pelo link/QR geral era
-- criado via create_checkin (SEM cooldown e SEM mesa), então o
-- cliente sempre aparecia em "Loja". Com o auto_checkin + cooldown,
-- se o cliente já tinha presença ativa (ex.: mapeado numa mesa),
-- o cooldown pulava o novo check-in e o cliente ficava preso na
-- mesa — sumindo da seção Loja.
--
-- Correção: dentro do cooldown de 4h, o check-in ativo é
-- RE-MAPEADO conforme a origem:
--   - QR da mesa      -> mesa escaneada (_table_id preenchido)
--   - link/QR geral   -> Loja (_table_id NULL)
-- Sem duplicar presença.
-- ============================================================

CREATE OR REPLACE FUNCTION private.auto_checkin(
  _customer_id uuid,
  _token uuid,
  _company_id uuid,
  _table_id uuid DEFAULT NULL,
  _source text DEFAULT 'link'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last timestamptz;
  v_active_id uuid;
BEGIN
  IF NOT private.verify_customer(_customer_id, _token) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = _customer_id AND company_id = _company_id) THEN
    RAISE EXCEPTION 'company mismatch';
  END IF;

  -- Último check-in AINDA ATIVO deste cliente nesta empresa
  SELECT id, created_at INTO v_active_id, v_last
  FROM checkins
  WHERE customer_id = _customer_id AND company_id = _company_id
    AND checked_out_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  -- Cooldown 4h: se já há presença recente, não duplica...
  IF v_active_id IS NOT NULL AND (now() - v_last) < interval '4 hours' THEN
    -- ...mas re-mapeia a localização do cliente conforme a origem:
    --   QR da mesa      -> mesa escaneada (_table_id preenchido)
    --   link/QR geral   -> Loja (_table_id NULL)
    UPDATE public.checkins
    SET table_id = _table_id
    WHERE id = v_active_id;
    RETURN false;
  END IF;

  INSERT INTO checkins (customer_id, company_id, table_id, context, source)
  VALUES (_customer_id, _company_id, _table_id, 'sozinho'::visit_context, COALESCE(_source, 'link'));

  RETURN true;
END;
$$;

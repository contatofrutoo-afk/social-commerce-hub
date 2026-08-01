-- ============================================================
-- Corrige o mapeamento do QR da Mesa na aba Atendimento.
--
-- Causa: private.auto_checkin tinha cooldown de 4h baseado no
-- último check-in (mesmo o que já foi finalizado via checkout).
-- Se o cliente escaneava o QR da mesa dentro desse período,
-- nenhum check-in novo era criado e o cliente NÃO aparecia na
-- seção Mesas (ficava preso no check-in antigo, geralmente na
-- seção Loja ou em outra mesa).
--
-- Correção:
-- 1. O cooldown passa a considerar apenas o último check-in
--    ATIVO (checked_out_at IS NULL).
-- 2. Se o cliente escaneou o QR de uma mesa dentro do cooldown,
--    o check-in ativo é re-mapeado para aquela mesa (presença
--    única preservada, mesa correta no Atendimento).
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
    -- ...mas se o cliente escaneou o QR de uma MESA, re-mapeia o
    -- check-in ativo para aquela mesa (presença única, mesa correta).
    IF _table_id IS NOT NULL THEN
      UPDATE public.checkins
      SET table_id = _table_id
      WHERE id = v_active_id;
    END IF;
    RETURN false;
  END IF;

  INSERT INTO checkins (customer_id, company_id, table_id, context, source)
  VALUES (_customer_id, _company_id, _table_id, 'sozinho'::visit_context, COALESCE(_source, 'link'));

  RETURN true;
END;
$$;

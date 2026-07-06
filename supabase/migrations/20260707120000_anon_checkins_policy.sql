-- =========================
-- Permite que clientes anônimos (anon) leiam checkins
-- Necessário porque checkinRepository.create faz .insert().select()
-- =========================

GRANT SELECT ON public.checkins TO anon;

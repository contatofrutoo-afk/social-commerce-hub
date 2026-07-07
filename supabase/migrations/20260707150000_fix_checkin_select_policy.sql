-- =========================
-- Cria SELECT policy para anon em checkins
-- Necessário porque checkinRepository.create faz .insert().select()
-- e a policy antiga "Anyone can read own checkin" foi dropada
-- pela migration 20260706205928 sem ser recriada
-- =========================

DROP POLICY IF EXISTS "Anon can read checkins" ON public.checkins;
CREATE POLICY "Anon can read checkins"
  ON public.checkins FOR SELECT TO anon
  USING (true);

-- =========================
-- Corrige INSERT + SELECT em checkins para anon
-- checkinRepository.create faz .insert().select().single()
-- Em PG15+, RETURNING * também exige SELECT policy
-- =========================

DROP POLICY IF EXISTS "Anyone can create checkin" ON public.checkins;

CREATE POLICY "Anyone can create checkin" ON public.checkins
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read own checkin" ON public.checkins
  FOR SELECT TO anon
  USING (true);

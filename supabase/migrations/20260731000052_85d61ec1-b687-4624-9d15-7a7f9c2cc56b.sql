CREATE TABLE public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document text NOT NULL CHECK (document IN ('terms','privacy')),
  version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, document, version)
);

GRANT SELECT, INSERT ON public.user_consents TO authenticated;
GRANT ALL ON public.user_consents TO service_role;

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consents"
  ON public.user_consents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can record own consents"
  ON public.user_consents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_user_consents_user ON public.user_consents (user_id, document);
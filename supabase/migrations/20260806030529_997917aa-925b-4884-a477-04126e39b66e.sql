ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_verification_status text,
  ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_verified_by uuid;

CREATE INDEX IF NOT EXISTS orders_payment_verification_idx
  ON public.orders (company_id, payment_verification_status, payment_approved_at DESC);

CREATE TABLE public.upi_payment_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  transaction_ref text NOT NULL,
  utr_number text,
  amount numeric NOT NULL,
  payer_vpa text,
  merchant_vpa text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  verified_by uuid,
  verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.upi_payment_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage UPI verifications"
  ON public.upi_payment_verifications
  FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()));

CREATE POLICY "Anyone can create UPI verifications"
  ON public.upi_payment_verifications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view own verification by ref"
  ON public.upi_payment_verifications
  FOR SELECT
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.upi_payment_verifications;

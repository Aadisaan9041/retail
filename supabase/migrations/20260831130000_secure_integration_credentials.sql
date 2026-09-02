-- Secure integration credential store.
-- Secrets are encrypted by the integration-credentials Edge Function before storage.
CREATE TABLE IF NOT EXISTS public.integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('razorpay','payu','meesho','flipkart','amazon','shipping','whatsapp','email')),
  environment TEXT NOT NULL DEFAULT 'test' CHECK (environment IN ('test','live','production')),
  credentials_ciphertext TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_tested_at TIMESTAMPTZ,
  last_test_status TEXT CHECK (last_test_status IN ('success','failed','unknown')),
  last_test_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, environment)
);

ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage integration credentials" ON public.integration_credentials;
CREATE POLICY "Admins can manage integration credentials"
ON public.integration_credentials
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Do not expose this table to normal staff. The frontend talks to the secure Edge Function.
DROP POLICY IF EXISTS "Staff can view integration credentials" ON public.integration_credentials;

CREATE OR REPLACE FUNCTION public.touch_integration_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_touch_integration_credentials ON public.integration_credentials;
CREATE TRIGGER trg_touch_integration_credentials
BEFORE UPDATE ON public.integration_credentials
FOR EACH ROW EXECUTE FUNCTION public.touch_integration_credentials_updated_at();

COMMENT ON TABLE public.integration_credentials IS 'Encrypted marketplace/payment/provider credentials. Ciphertext is produced by the Edge Function; secrets are never returned to the browser.';

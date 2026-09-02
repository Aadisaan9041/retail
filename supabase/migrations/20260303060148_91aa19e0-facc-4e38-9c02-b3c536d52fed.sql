-- Allow public read of storefront-relevant settings
CREATE POLICY "Anyone can view public settings"
ON public.app_settings
FOR SELECT
USING (key IN ('appSettings', 'webstoreSettings', 'paymentSettings'));
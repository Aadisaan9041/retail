# Retail System — Supabase Backend Bundle

This bundle contains the Supabase backend shipped with `retail-system-final-2026-09-02`.

## Contents
- `supabase/migrations/` — 22 SQL migrations, in timestamp order.
- `supabase/functions/` — 24 Edge Functions.
- `supabase/config.toml` — Edge Function configuration.
- `FULL_SUPABASE_MIGRATION.sql` — consolidated SQL copy of all migrations, in filename order.

## Edge Functions
- ai-customer-support
- ai-image-product-match
- ai-inventory-recommendations
- ai-product-assistant
- ai-product-search
- barcode-product-lookup
- create-admin-user
- daily-inventory-report
- daily-upi-summary
- delhivery-shipping-rates
- integration-credentials
- inventory-sync
- marketplace-inventory-sync
- payu-payment
- price-override-alert
- razorpay-payment
- send-bill-notification
- send-inventory-alert
- send-order-notification
- storefront-checkout
- track-order
- upi-payment-alert
- upi-payment-receipt
- upi-verification-status
- voice-assistant
- whatsapp-upi-alert

## Fresh-project deployment
1. Copy the `supabase/` directory into the project.
2. Set `project_id` in `supabase/config.toml` to the new Supabase project ref.
3. Run `npx supabase login`.
4. Run `npx supabase link --project-ref NEW_PROJECT_REF`.
5. Run `npx supabase db push` to apply the migration set.
6. Deploy the Edge Functions with `npx supabase functions deploy FUNCTION_NAME`.
7. Configure server-side secrets, including `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY` and `MARKETPLACE_ENVIRONMENT`.

Do not commit service-role keys, provider secrets, or the encryption key.

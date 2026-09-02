# Admin Integration Center

The app now includes **Admin → Settings → Integrations & API**.

Supported configuration slots:
- Razorpay (Test/Live)
- PayU (Test/Live)
- Meesho (Test/Live)
- Flipkart (Test/Live)
- Amazon SP-API / LWA (Test/Live)

## Security
Credentials are not stored in `app_settings` or browser localStorage by the new Integration Center. The browser sends them to the `integration-credentials` Edge Function over HTTPS. The function encrypts them with AES-256-GCM and stores only ciphertext in `integration_credentials`.

Set this Supabase Edge Function secret before deployment:

`INTEGRATION_CREDENTIALS_ENCRYPTION_KEY=<long-random-secret>`

Do not put this secret in Vite `.env`, source control, or frontend code.

## Important
The UI is the credential/configuration center. A live marketplace connection still requires the seller account's approved API/OAuth access. The existing marketplace function in this repository still contains simulated marketplace calls and must be replaced with the real provider adapter before live listing/inventory sync is claimed as operational.

Razorpay's live credentials should only be enabled after the merchant account and website are verified. Use Test mode first.

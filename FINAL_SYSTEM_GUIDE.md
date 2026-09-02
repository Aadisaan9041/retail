# Retail System — Final Deployment Candidate

This package is the consolidated build of the garment-store system.

## Core workflow

1. Create products from garment photos with AI assistance.
2. Maintain product variants, stock, cost, MRP and selling price.
3. POS visual scan searches the store catalogue; it does not auto-add a sale.
4. Cashier confirms product/variant.
5. Cashier enters the negotiated transaction price.
6. Item is added to the bill only after confirmation.
7. Bill-level gross profit is recalculated after every price change.
8. A bill may contain below-cost items when the overall bill still meets the configured minimum gross profit.
9. Finalization is validated server-side.
10. Successful sale creates transaction records and inventory movement.

## Admin configuration

Admin > Settings includes:

- POS / minimum bill gross profit
- GST/tax settings
- Payment settings
- Integrations & API Credentials
- Shipping provider credentials
- Webstore settings
- Delivery partner settings
- Price override audit
- User management

## Integration credential policy

Secrets are sent to the `integration-credentials` Supabase Edge Function and encrypted with AES-GCM before database storage. Do not put marketplace/payment secrets in Vite frontend environment variables.

Set this Supabase Edge Function secret before saving live credentials:

`INTEGRATION_CREDENTIALS_ENCRYPTION_KEY=<long-random-secret>`

The frontend only receives connection status and masked metadata after credentials are saved.

## Live marketplace setup

The UI supports credential storage for Amazon, Flipkart, Meesho, Razorpay, PayU and a generic shipping provider. Live listing/order APIs still require the seller/provider's approved credentials and endpoint-specific implementation. Never treat a stored credential as proof that a marketplace listing API is live until a real connection test and test listing/order have succeeded.

## Required go-live checks

- Apply all Supabase migrations in order.
- Configure Edge Function secrets.
- Connect seller/payment/shipping accounts from Admin Settings.
- Create at least 10 real products and variants.
- Test visual recognition on the actual phone/camera.
- Test POS negotiation and bill-profit blocking.
- Test stock deduction and returns.
- Test one real/sandbox payment.
- Test one marketplace listing per connected marketplace.
- Test order ingestion and inventory synchronization.
- Verify GST/invoice details with the business's tax setup.
- Run `npm ci` and `npm run build` in a network-enabled deployment environment.

## Important

This repository is the final development candidate, not a claim that third-party marketplace credentials are already connected. Credentials must be entered by the store administrator and live API onboarding must be verified before production sales are enabled.

# Today deployment checklist

## Core POS

1. Apply all Supabase migrations in order.
2. Deploy the `ai-image-product-match` Edge Function with its AI provider secret.
3. Deploy the updated POS source.
4. In POS Settings set **Minimum Gross Profit Per Bill**.
5. Test: scan garment -> select product -> select variant -> enter negotiated price -> Confirm & Add.
6. Test a bill where one item is below cost but the bill remains profitable.
7. Test a bill where total gross profit is below the configured floor; Final Payment must be disabled and the server RPC must reject it.
8. Test stock deduction for both parent products and variants.

## Marketplace

The UI and data model contain marketplace fields, export templates, and inventory-sync plumbing for Meesho, Flipkart and Amazon. Actual live listing/order APIs require the seller accounts, authorization credentials and marketplace-approved API access. The current repository deliberately does not pretend simulated API calls are real marketplace publishing. Before enabling live sync, replace the simulation in `supabase/functions/marketplace-inventory-sync/index.ts` with authenticated adapters and store external listing IDs in a marketplace-listing table.

Amazon uses Selling Partner API authorization; Flipkart exposes seller APIs. Meesho's seller-side access should be enabled using the seller account's supported integration route rather than hard-coded undocumented endpoints.

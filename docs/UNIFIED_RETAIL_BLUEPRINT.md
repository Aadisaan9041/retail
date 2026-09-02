# Unified AI Garment Retail Blueprint

## Core rule
One master catalogue and one inventory source of truth feed the physical POS, website, and marketplace channels.

## Physical POS flow
1. Open Visual Scanner.
2. Camera captures the garment itself; barcode is optional, not required.
3. AI searches the store's catalogue using visual similarity plus detected colour, pattern, design, text/brand and other attributes.
4. AI returns candidate product(s), confidence and available variants.
5. Cashier explicitly confirms the product and variant.
6. Cashier enters the actual negotiated customer price. This is a sale-level price and never changes the catalogue price.
7. Item is added to the bill only after confirmation.
8. Final bill checks total revenue minus cost minus bill discounts against the configured minimum gross-profit floor.
9. A single item may be below cost when the complete bill remains above the floor.
10. If the final bill is below the floor, final billing is blocked.
11. Successful payment commits transaction and inventory atomically.

## Inventory
Variants are first-class inventory units. A variant sale decrements variant stock; non-variant products decrement product stock. Transaction items retain the variant ID and negotiated unit price.

## Marketplace architecture
Master product -> marketplace adapters -> Meesho / Flipkart / Amazon / Website. Marketplace listings have their own external identifiers and channel-specific attributes/prices, while stock is sourced from the master inventory.

## Current implementation in this build
- Visual AI scanner no longer auto-adds high-confidence matches.
- POS shows a product/variant confirmation and negotiated-price step before adding a scanned item.
- Cart supports variant-aware keys and variant pricing/cost.
- Checkout no longer allows a second arbitrary total override; negotiation happens at item confirmation.
- Bill-level gross-profit protection is implemented client-side for immediate feedback and server-side through an atomic Supabase RPC.
- Variant-aware transaction item storage and inventory deduction are included in the migration.
- POS settings now include a configurable minimum gross profit per bill.
- The existing marketplace integration scaffolding is retained for the next implementation phase; production API credentials, seller onboarding and channel-specific listing workflows still require configuration/testing against the seller accounts.

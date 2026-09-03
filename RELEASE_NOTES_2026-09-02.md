# Retail System — Release Candidate 2026-09-02

## Included
- Supabase-backed product/catalog workflow.
- Admin settings for secure integration credentials.
- AES-GCM encrypted integration credential storage through a server-side Edge Function.
- Amazon LWA credential test.
- Marketplace sync endpoint secured to admin/manager callers.
- Marketplace synchronization no longer reports fake/simulated success.
- `.env.example` for clean deployment configuration.
- Updated go-live checklist and deployment documentation.

## Important external dependency
Real Amazon/Flipkart/Meesho listing and inventory synchronization depends on the seller's approved API access and the provider's current API contract. The application intentionally fails closed instead of pretending a write succeeded.

## Validation performed in this environment
- Source package inspected.
- Security-sensitive marketplace simulation removed.
- Documentation and deployment configuration updated.
- Full frontend build could not be rerun in this sandbox because dependency installation was unavailable/timed out; run `npm install` followed by `npm run build` on the deployment machine.

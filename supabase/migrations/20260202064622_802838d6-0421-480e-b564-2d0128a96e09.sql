-- Remove overly permissive public INSERT policies on transactions and transaction_items
-- These allow anyone to create fraudulent transactions without authentication
-- Staff policies already exist, so we just need to remove the public ones

DROP POLICY IF EXISTS "Anyone can create transactions" ON public.transactions;
DROP POLICY IF EXISTS "Anyone can create transaction items" ON public.transaction_items;
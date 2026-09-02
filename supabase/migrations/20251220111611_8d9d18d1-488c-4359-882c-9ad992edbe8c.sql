-- Allow public read access to products for storefront
CREATE POLICY "Anyone can view products"
ON public.products
FOR SELECT
USING (true);

-- Allow public read access to categories for storefront
CREATE POLICY "Anyone can view categories"
ON public.categories
FOR SELECT
USING (true);

-- Update transactions to allow public insert for guest checkout
CREATE POLICY "Anyone can create transactions"
ON public.transactions
FOR INSERT
WITH CHECK (true);

-- Update transaction_items to allow public insert for guest checkout
CREATE POLICY "Anyone can create transaction items"
ON public.transaction_items
FOR INSERT
WITH CHECK (true);
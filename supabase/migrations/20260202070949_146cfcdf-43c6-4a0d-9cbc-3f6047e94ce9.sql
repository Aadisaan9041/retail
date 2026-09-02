-- Drop the overly permissive orders SELECT policy
DROP POLICY IF EXISTS "Anyone can view orders by tracking" ON public.orders;

-- Create restrictive policy: staff can view all, public access denied (use edge function instead)
CREATE POLICY "Staff can view all orders"
ON public.orders
FOR SELECT
USING (is_staff(auth.uid()));

-- Staff can update orders
CREATE POLICY "Staff can update orders"
ON public.orders
FOR UPDATE
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));

-- Staff can insert orders
CREATE POLICY "Staff can insert orders"
ON public.orders
FOR INSERT
WITH CHECK (is_staff(auth.uid()) OR auth.uid() IS NULL);

-- Staff can delete orders
CREATE POLICY "Staff can delete orders"
ON public.orders
FOR DELETE
USING (is_staff(auth.uid()));
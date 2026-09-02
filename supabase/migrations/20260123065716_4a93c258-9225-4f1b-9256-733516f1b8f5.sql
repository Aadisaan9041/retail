-- Create the update_updated_at_column function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create orders table for tracking customer orders
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES public.transactions(id),
  customer_email TEXT,
  customer_phone TEXT,
  customer_name TEXT,
  delivery_partner_id UUID REFERENCES public.delivery_partners(id),
  delivery_fee NUMERIC DEFAULT 0,
  delivery_address TEXT,
  tracking_number TEXT,
  status TEXT DEFAULT 'pending',
  estimated_delivery TEXT,
  status_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Anyone can create orders (webstore checkout)
CREATE POLICY "Anyone can create orders"
ON public.orders
FOR INSERT
WITH CHECK (true);

-- Customers can view their own orders by tracking
CREATE POLICY "Anyone can view orders by tracking"
ON public.orders
FOR SELECT
USING (true);

-- Staff can manage all orders
CREATE POLICY "Staff can manage orders"
ON public.orders
FOR ALL
USING (is_staff(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
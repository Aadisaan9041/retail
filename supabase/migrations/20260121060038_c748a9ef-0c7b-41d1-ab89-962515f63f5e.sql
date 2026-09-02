-- Create price override audit log table
CREATE TABLE public.price_override_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  original_price NUMERIC NOT NULL,
  modified_price NUMERIC NOT NULL,
  user_id UUID NOT NULL,
  user_name TEXT,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.price_override_logs ENABLE ROW LEVEL SECURITY;

-- Policies for price override logs
CREATE POLICY "Staff can create price override logs"
ON public.price_override_logs
FOR INSERT
WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Staff can view price override logs"
ON public.price_override_logs
FOR SELECT
USING (is_staff(auth.uid()));

CREATE POLICY "Only admins/managers can delete logs"
ON public.price_override_logs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
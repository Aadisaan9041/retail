-- Create loyalty_tiers table for reward tiers
CREATE TABLE public.loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  min_points INTEGER NOT NULL DEFAULT 0,
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  benefits TEXT[],
  color TEXT DEFAULT '#667eea',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create loyalty_points_history table to track points transactions
CREATE TABLE public.loyalty_points_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earned', 'redeemed', 'expired', 'bonus', 'adjustment')),
  description TEXT,
  transaction_id UUID REFERENCES public.transactions(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_points_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for loyalty_tiers (public read, admin write)
CREATE POLICY "Anyone can view loyalty tiers" ON public.loyalty_tiers
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage loyalty tiers" ON public.loyalty_tiers
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for loyalty_points_history
CREATE POLICY "Staff can view points history" ON public.loyalty_points_history
  FOR SELECT USING (is_staff(auth.uid()));

CREATE POLICY "Staff can create points history" ON public.loyalty_points_history
  FOR INSERT WITH CHECK (is_staff(auth.uid()));

-- Insert default loyalty tiers
INSERT INTO public.loyalty_tiers (name, min_points, discount_percentage, benefits, color) VALUES
  ('Bronze', 0, 0, ARRAY['Earn 1 point per $1 spent', 'Birthday bonus points'], '#CD7F32'),
  ('Silver', 500, 5, ARRAY['Earn 1.5 points per $1 spent', '5% discount on all purchases', 'Early access to sales'], '#C0C0C0'),
  ('Gold', 1500, 10, ARRAY['Earn 2 points per $1 spent', '10% discount on all purchases', 'Free shipping', 'Priority support'], '#FFD700'),
  ('Platinum', 5000, 15, ARRAY['Earn 3 points per $1 spent', '15% discount on all purchases', 'Free shipping', 'VIP support', 'Exclusive events'], '#E5E4E2');

-- Create index for faster queries
CREATE INDEX idx_loyalty_points_history_customer ON public.loyalty_points_history(customer_id);
CREATE INDEX idx_loyalty_points_history_created ON public.loyalty_points_history(created_at DESC);
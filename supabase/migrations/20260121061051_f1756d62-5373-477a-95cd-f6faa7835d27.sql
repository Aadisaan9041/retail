-- Create delivery_partners table for webstore deliveries
CREATE TABLE public.delivery_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  api_endpoint TEXT,
  api_key TEXT,
  service_areas TEXT[],
  is_active BOOLEAN DEFAULT true,
  delivery_fee NUMERIC DEFAULT 0,
  min_order_value NUMERIC DEFAULT 0,
  estimated_delivery_time TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;

-- Only admins can manage delivery partners
CREATE POLICY "Admins can manage delivery partners"
ON public.delivery_partners
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Staff can view delivery partners
CREATE POLICY "Staff can view delivery partners"
ON public.delivery_partners
FOR SELECT
USING (is_staff(auth.uid()));

-- Anyone can view active delivery partners (for webstore)
CREATE POLICY "Anyone can view active delivery partners"
ON public.delivery_partners
FOR SELECT
USING (is_active = true);

-- Create trigger to update updated_at
CREATE TRIGGER update_delivery_partners_updated_at
BEFORE UPDATE ON public.delivery_partners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Add price_override_threshold setting table
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage app settings
CREATE POLICY "Admins can manage app settings"
ON public.app_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff can view app settings
CREATE POLICY "Staff can view app settings"
ON public.app_settings
FOR SELECT
USING (is_staff(auth.uid()));

-- Insert default price override threshold setting
INSERT INTO public.app_settings (key, value) 
VALUES ('price_override_threshold', '{"amount": 50, "notify_email": ""}'::jsonb);
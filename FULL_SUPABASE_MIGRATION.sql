-- Consolidated Supabase migration set from retail-system-final-2026-09-02
-- Generated in migration filename order. For production, prefer `supabase db push` so migration history is preserved.


----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20251218121007_7d280e7b-cfaf-4790-acce-9b9d8a1f754a.sql
----------------------------------------------------------------------------------------------------
-- Create app roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'cashier');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'cashier',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  category_id UUID REFERENCES public.categories(id),
  image_url TEXT,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  reorder_quantity INTEGER DEFAULT 50,
  auto_reorder BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create customers table for loyalty program
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  loyalty_points INTEGER DEFAULT 0,
  total_spent NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID REFERENCES auth.users(id),
  customer_id UUID REFERENCES public.customers(id),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  loyalty_points_earned INTEGER DEFAULT 0,
  loyalty_points_redeemed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create transaction_items table
CREATE TABLE public.transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create reorder_requests table for auto-reorder system
CREATE TABLE public.reorder_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  fulfilled_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reorder_requests ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has any role (is authenticated staff)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles policies (only admins can manage roles)
CREATE POLICY "Staff can view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Categories policies (staff can view, admin/manager can modify)
CREATE POLICY "Staff can view categories" ON public.categories
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins can manage categories" ON public.categories
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Products policies
CREATE POLICY "Staff can view products" ON public.products
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update product quantity" ON public.products
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins/Managers can manage products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Admins/Managers can delete products" ON public.products
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Customers policies
CREATE POLICY "Staff can view customers" ON public.customers
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can manage customers" ON public.customers
  FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- Transactions policies
CREATE POLICY "Staff can view transactions" ON public.transactions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can create transactions" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- Transaction items policies
CREATE POLICY "Staff can view transaction items" ON public.transaction_items
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can create transaction items" ON public.transaction_items
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- Reorder requests policies
CREATE POLICY "Staff can view reorder requests" ON public.reorder_requests
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "System can create reorder requests" ON public.reorder_requests
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins can manage reorder requests" ON public.reorder_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Create trigger to update product quantity on sale
CREATE OR REPLACE FUNCTION public.update_product_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET quantity = quantity - NEW.quantity,
      updated_at = now()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_transaction_item_created
  AFTER INSERT ON public.transaction_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_quantity();

-- Create trigger to check for auto-reorder
CREATE OR REPLACE FUNCTION public.check_auto_reorder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_record RECORD;
BEGIN
  SELECT * INTO product_record FROM public.products WHERE id = NEW.id;
  
  IF product_record.auto_reorder = true 
     AND product_record.quantity <= product_record.low_stock_threshold THEN
    INSERT INTO public.reorder_requests (product_id, quantity, status)
    VALUES (NEW.id, COALESCE(product_record.reorder_quantity, 50), 'pending')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_product_quantity_low
  AFTER UPDATE OF quantity ON public.products
  FOR EACH ROW
  WHEN (NEW.quantity <= NEW.low_stock_threshold)
  EXECUTE FUNCTION public.check_auto_reorder();

-- Create trigger for new user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update customer loyalty points
CREATE OR REPLACE FUNCTION public.update_customer_loyalty()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET loyalty_points = loyalty_points + NEW.loyalty_points_earned - NEW.loyalty_points_redeemed,
        total_spent = total_spent + NEW.total,
        updated_at = now()
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_transaction_completed
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_loyalty();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
-- END MIGRATION: 20251218121007_7d280e7b-cfaf-4790-acce-9b9d8a1f754a.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20251219032349_6bea2c7f-c71c-47e6-a777-67b476ee814c.sql
----------------------------------------------------------------------------------------------------
-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Allow anyone to view product images (public bucket)
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Allow staff to upload product images
CREATE POLICY "Staff can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' AND
  public.is_staff(auth.uid())
);

-- Allow staff to update product images
CREATE POLICY "Staff can update product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images' AND
  public.is_staff(auth.uid())
);

-- Allow staff to delete product images
CREATE POLICY "Staff can delete product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images' AND
  public.is_staff(auth.uid())
);
-- END MIGRATION: 20251219032349_6bea2c7f-c71c-47e6-a777-67b476ee814c.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20251220111611_8d9d18d1-488c-4359-882c-9ad992edbe8c.sql
----------------------------------------------------------------------------------------------------
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
-- END MIGRATION: 20251220111611_8d9d18d1-488c-4359-882c-9ad992edbe8c.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20251226084659_0a3fbf17-2a20-41be-b529-5b7a044b38cb.sql
----------------------------------------------------------------------------------------------------
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
-- END MIGRATION: 20251226084659_0a3fbf17-2a20-41be-b529-5b7a044b38cb.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20251226085546_c1475f21-c098-4ce4-9d44-f7a47fd4c632.sql
----------------------------------------------------------------------------------------------------

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Enable pg_net extension for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- END MIGRATION: 20251226085546_c1475f21-c098-4ce4-9d44-f7a47fd4c632.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20260119144741_625fc8fb-5e4b-4683-8a98-b5cbea01604e.sql
----------------------------------------------------------------------------------------------------
-- Create function to check if user is a customer using text casting
CREATE OR REPLACE FUNCTION public.is_customer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = 'customer'
  )
$$;

-- Update is_staff to also return true for customers (they are valid users)
CREATE OR REPLACE FUNCTION public.is_any_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
  )
$$;

-- Create a function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;
-- END MIGRATION: 20260119144741_625fc8fb-5e4b-4683-8a98-b5cbea01604e.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20260121060038_c748a9ef-0c7b-41d1-ab89-962515f63f5e.sql
----------------------------------------------------------------------------------------------------
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
-- END MIGRATION: 20260121060038_c748a9ef-0c7b-41d1-ab89-962515f63f5e.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20260121061051_f1756d62-5373-477a-95cd-f6faa7835d27.sql
----------------------------------------------------------------------------------------------------
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
-- END MIGRATION: 20260121061051_f1756d62-5373-477a-95cd-f6faa7835d27.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20260123065716_4a93c258-9225-4f1b-9256-733516f1b8f5.sql
----------------------------------------------------------------------------------------------------
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
-- END MIGRATION: 20260123065716_4a93c258-9225-4f1b-9256-733516f1b8f5.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20260202064622_802838d6-0421-480e-b564-2d0128a96e09.sql
----------------------------------------------------------------------------------------------------
-- Remove overly permissive public INSERT policies on transactions and transaction_items
-- These allow anyone to create fraudulent transactions without authentication
-- Staff policies already exist, so we just need to remove the public ones

DROP POLICY IF EXISTS "Anyone can create transactions" ON public.transactions;
DROP POLICY IF EXISTS "Anyone can create transaction items" ON public.transaction_items;
-- END MIGRATION: 20260202064622_802838d6-0421-480e-b564-2d0128a96e09.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20260202065955_f06eb6c0-d61c-4f21-8799-b23b91d68be8.sql
----------------------------------------------------------------------------------------------------
-- Fix delivery_partners table: Remove public access to sensitive columns (api_key, api_endpoint)
-- Create a secure public view that excludes credentials

-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can view active delivery partners" ON public.delivery_partners;

-- Create a secure view for public access (excludes sensitive columns)
CREATE OR REPLACE VIEW public.delivery_partners_public
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  phone,
  email,
  service_areas,
  is_active,
  delivery_fee,
  min_order_value,
  estimated_delivery_time,
  created_at,
  updated_at
FROM public.delivery_partners
WHERE is_active = true;

-- Grant access to the view for anonymous and authenticated users
GRANT SELECT ON public.delivery_partners_public TO anon, authenticated;

-- Add a comment to document the security purpose
COMMENT ON VIEW public.delivery_partners_public IS 'Public view of delivery partners excluding sensitive API credentials (api_key, api_endpoint)';

-- END MIGRATION: 20260202065955_f06eb6c0-d61c-4f21-8799-b23b91d68be8.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20260202070949_146cfcdf-43c6-4a0d-9cbc-3f6047e94ce9.sql
----------------------------------------------------------------------------------------------------
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
-- END MIGRATION: 20260202070949_146cfcdf-43c6-4a0d-9cbc-3f6047e94ce9.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20260205075957_2682a9ee-926d-4e32-8fe5-1ab416ee580c.sql
----------------------------------------------------------------------------------------------------
-- Add marketplace-compatible fields to products table for Meesho, Amazon, Flipkart compatibility
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS mrp numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS fabric text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pattern text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS fit_shape text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS occasion text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sleeve_length text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS neck_type text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS net_weight_grams integer;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS net_quantity integer DEFAULT 1;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS generic_name text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS country_of_origin text DEFAULT 'India';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS manufacturer_name text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS manufacturer_address text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS manufacturer_pincode text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS packer_name text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS packer_address text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS packer_pincode text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS importer_name text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS importer_address text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS importer_pincode text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ean_upc text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS style_id text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS group_id text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS hemline text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS length_type text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sleeve_styling text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS print_pattern_type text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS character_theme text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS number_of_pockets integer;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS chest_size text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS length_size text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shoulder_size text;

-- Add multiple image support
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url_2 text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url_3 text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url_4 text;

-- Create product variants table for size/color combinations
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  variation text NOT NULL, -- e.g., S, M, L, XL, 38, 40, Free Size
  color text,
  sku text NOT NULL,
  barcode text,
  price numeric NOT NULL DEFAULT 0,
  mrp numeric NOT NULL DEFAULT 0,
  cost numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 0,
  meesho_price numeric,
  wrong_defective_price numeric,
  image_url text,
  chest_size text,
  length_size text,
  shoulder_size text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on product_variants
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_variants
CREATE POLICY "Anyone can view product variants"
ON public.product_variants
FOR SELECT
USING (true);

CREATE POLICY "Staff can manage product variants"
ON public.product_variants
FOR ALL
USING (is_staff(auth.uid()));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON public.product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
CREATE INDEX IF NOT EXISTS idx_products_style_id ON public.products(style_id);
-- END MIGRATION: 20260205075957_2682a9ee-926d-4e32-8fe5-1ab416ee580c.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20260303060148_91aa19e0-facc-4e38-9c02-b3c536d52fed.sql
----------------------------------------------------------------------------------------------------
-- Allow public read of storefront-relevant settings
CREATE POLICY "Anyone can view public settings"
ON public.app_settings
FOR SELECT
USING (key IN ('appSettings', 'webstoreSettings', 'paymentSettings'));
-- END MIGRATION: 20260303060148_91aa19e0-facc-4e38-9c02-b3c536d52fed.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20260303060606_c424a8e8-59f4-475f-ba79-a4afdf1558f7.sql
----------------------------------------------------------------------------------------------------
-- Drop and recreate the view with SECURITY INVOKER = FALSE (default)
-- so it runs as the view owner (postgres) bypassing RLS on the underlying table
DROP VIEW IF EXISTS public.delivery_partners_public;

CREATE VIEW public.delivery_partners_public
WITH (security_barrier = false)
AS
SELECT id, name, phone, email, service_areas, is_active, delivery_fee,
       min_order_value, estimated_delivery_time, created_at, updated_at
FROM delivery_partners
WHERE is_active = true;

-- Grant SELECT to anon and authenticated
GRANT SELECT ON public.delivery_partners_public TO anon, authenticated;
-- END MIGRATION: 20260303060606_c424a8e8-59f4-475f-ba79-a4afdf1558f7.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20260308115218_24853b44-80bc-4f75-9515-66d4580a33f7.sql
----------------------------------------------------------------------------------------------------

CREATE TABLE public.upi_payment_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  transaction_ref text NOT NULL,
  utr_number text,
  amount numeric NOT NULL,
  payer_vpa text,
  merchant_vpa text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  verified_by uuid,
  verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.upi_payment_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage UPI verifications"
  ON public.upi_payment_verifications
  FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()));

CREATE POLICY "Anyone can create UPI verifications"
  ON public.upi_payment_verifications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view own verification by ref"
  ON public.upi_payment_verifications
  FOR SELECT
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.upi_payment_verifications;

-- END MIGRATION: 20260308115218_24853b44-80bc-4f75-9515-66d4580a33f7.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20260308170825_54daf946-5d3d-4c9d-87f5-bbbf6ab3ff24.sql
----------------------------------------------------------------------------------------------------

-- Create suppliers table
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  gst_number text,
  payment_terms text DEFAULT '30 days',
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add supplier_id to products
ALTER TABLE public.products ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Staff can view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "Admins can manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Updated at trigger
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- END MIGRATION: 20260308170825_54daf946-5d3d-4c9d-87f5-bbbf6ab3ff24.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20260308173104_057cc666-b70a-49c8-aba7-410004c9c114.sql
----------------------------------------------------------------------------------------------------
CREATE POLICY "Admins can delete suppliers" ON public.suppliers FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
-- END MIGRATION: 20260308173104_057cc666-b70a-49c8-aba7-410004c9c114.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20260308200313_d6c14663-0777-4e07-94df-9568d081a027.sql
----------------------------------------------------------------------------------------------------
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer';
-- END MIGRATION: 20260308200313_d6c14663-0777-4e07-94df-9568d081a027.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20260831110000_unified_visual_pos.sql
----------------------------------------------------------------------------------------------------
-- Unified visual POS: variant-aware stock, bill-level profit protection, and negotiated prices.
-- Apply after the existing retail migrations.

ALTER TABLE public.transaction_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id);

CREATE INDEX IF NOT EXISTS idx_transaction_items_variant_id
  ON public.transaction_items(variant_id);

-- Default minimum bill gross profit is zero; owner can change app_settings.value.
INSERT INTO public.app_settings (key, value)
VALUES ('minimum_bill_gross_profit', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Variant-aware inventory deduction. A variant sale decrements the variant only;
-- a non-variant sale decrements the parent product.
CREATE OR REPLACE FUNCTION public.update_inventory_after_transaction_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.variant_id IS NOT NULL THEN
    UPDATE public.product_variants
      SET quantity = quantity - NEW.quantity, updated_at = now()
      WHERE id = NEW.variant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant % not found', NEW.variant_id;
    END IF;
  ELSE
    UPDATE public.products
      SET quantity = quantity - NEW.quantity, updated_at = now()
      WHERE id = NEW.product_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', NEW.product_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_transaction_item_created ON public.transaction_items;
DROP TRIGGER IF EXISTS update_product_quantity_trigger ON public.transaction_items;
CREATE TRIGGER update_product_quantity_trigger
AFTER INSERT ON public.transaction_items
FOR EACH ROW EXECUTE FUNCTION public.update_inventory_after_transaction_item();

-- Do not award loyalty until a transaction is actually completed.
CREATE OR REPLACE FUNCTION public.update_customer_loyalty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') AND NEW.customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET loyalty_points = loyalty_points + NEW.loyalty_points_earned - NEW.loyalty_points_redeemed,
        total_spent = total_spent + NEW.total,
        updated_at = now()
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_transaction_created ON public.transactions;
DROP TRIGGER IF EXISTS update_customer_loyalty_trigger ON public.transactions;
CREATE TRIGGER update_customer_loyalty_trigger
AFTER INSERT OR UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.update_customer_loyalty();

-- Deferred validation runs at COMMIT, after every transaction item has been inserted.
-- This permits one item to be below cost as long as the complete bill remains profitable.
CREATE OR REPLACE FUNCTION public.validate_completed_pos_bill_profit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  tx RECORD;
  bill_cost numeric := 0;
  bill_revenue numeric := 0;
  minimum_profit numeric := 0;
BEGIN
  SELECT * INTO tx FROM public.transactions WHERE id = NEW.transaction_id;
  IF tx.status <> 'completed' THEN RETURN NEW; END IF;

  SELECT CASE
    WHEN jsonb_typeof(value) = 'object' AND value ? 'amount' THEN (value->>'amount')::numeric
    WHEN jsonb_typeof(value) = 'number' THEN value::text::numeric
    ELSE 0
  END
    INTO minimum_profit
    FROM public.app_settings
    WHERE key = 'minimum_bill_gross_profit';
  minimum_profit := COALESCE(minimum_profit, 0);

  SELECT COALESCE(SUM(ti.total_price),0),
         COALESCE(SUM(ti.quantity * COALESCE(ti.unit_cost, pv.cost, p.cost)),0)
    INTO bill_revenue, bill_cost
    FROM public.transaction_items ti
    JOIN public.products p ON p.id = ti.product_id
    LEFT JOIN public.product_variants pv ON pv.id = ti.variant_id
    WHERE ti.transaction_id = NEW.transaction_id;

  IF (bill_revenue - COALESCE(tx.discount,0) - bill_cost) < minimum_profit THEN
    RAISE EXCEPTION 'BILL_PROFIT_TOO_LOW: gross profit % is below minimum %',
      ROUND(bill_revenue - COALESCE(tx.discount,0) - bill_cost, 2), ROUND(minimum_profit, 2);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_completed_pos_bill_profit ON public.transaction_items;
CREATE CONSTRAINT TRIGGER validate_completed_pos_bill_profit
AFTER INSERT OR UPDATE ON public.transaction_items
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.validate_completed_pos_bill_profit();


-- Atomic POS transaction API. The client sends the already-confirmed negotiated
-- item prices; this function performs the authoritative stock and profit checks
-- and commits the transaction + items together.
CREATE OR REPLACE FUNCTION public.create_pos_transaction(
  p_cashier_id uuid,
  p_customer_id uuid,
  p_payment_method text,
  p_subtotal numeric,
  p_tax numeric,
  p_discount numeric,
  p_total numeric,
  p_loyalty_points_earned integer,
  p_loyalty_points_redeemed integer,
  p_items jsonb
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_price numeric;
  v_cost numeric;
  v_bill_cost numeric := 0;
  v_bill_revenue numeric := 0;
  v_min_profit numeric := 0;
  v_tx public.transactions;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_cashier_id OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'POS_UNAUTHORIZED';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'POS_EMPTY_BILL';
  END IF;

  SELECT CASE
    WHEN jsonb_typeof(value) = 'object' AND value ? 'amount' THEN (value->>'amount')::numeric
    WHEN jsonb_typeof(value) = 'number' THEN value::text::numeric
    ELSE 0
  END INTO v_min_profit
  FROM public.app_settings WHERE key = 'minimum_bill_gross_profit';
  v_min_profit := COALESCE(v_min_profit, 0);

  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (item->>'product_id')::uuid;
    v_variant_id := NULLIF(item->>'variant_id','')::uuid;
    v_quantity := (item->>'quantity')::integer;
    v_unit_price := (item->>'unit_price')::numeric;

    IF v_quantity <= 0 OR v_unit_price < 0 THEN
      RAISE EXCEPTION 'POS_INVALID_ITEM';
    END IF;

    IF v_variant_id IS NOT NULL THEN
      SELECT cost INTO v_cost FROM public.product_variants WHERE id = v_variant_id AND product_id = v_product_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'POS_VARIANT_NOT_FOUND'; END IF;
      IF (SELECT quantity FROM public.product_variants WHERE id = v_variant_id) < v_quantity THEN
        RAISE EXCEPTION 'POS_INSUFFICIENT_STOCK';
      END IF;
    ELSE
      SELECT cost INTO v_cost FROM public.products WHERE id = v_product_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'POS_PRODUCT_NOT_FOUND'; END IF;
      IF (SELECT quantity FROM public.products WHERE id = v_product_id) < v_quantity THEN
        RAISE EXCEPTION 'POS_INSUFFICIENT_STOCK';
      END IF;
    END IF;

    v_bill_cost := v_bill_cost + v_cost * v_quantity;
    v_bill_revenue := v_bill_revenue + v_unit_price * v_quantity;
  END LOOP;

  IF ABS(v_bill_revenue - COALESCE(p_subtotal,0)) > 0.01 THEN
    RAISE EXCEPTION 'POS_TOTAL_MISMATCH';
  END IF;

  IF (v_bill_revenue - COALESCE(p_discount,0) - v_bill_cost) < v_min_profit THEN
    RAISE EXCEPTION 'BILL_PROFIT_TOO_LOW: gross profit % is below minimum %',
      ROUND(v_bill_revenue - COALESCE(p_discount,0) - v_bill_cost, 2), ROUND(v_min_profit, 2);
  END IF;

  IF ABS((v_bill_revenue - COALESCE(p_discount,0) + COALESCE(p_tax,0)) - COALESCE(p_total,0)) > 0.01 THEN
    RAISE EXCEPTION 'POS_TOTAL_MISMATCH';
  END IF;

  INSERT INTO public.transactions (
    cashier_id, customer_id, subtotal, tax, discount, total,
    payment_method, loyalty_points_earned, loyalty_points_redeemed, status
  ) VALUES (
    p_cashier_id, p_customer_id, p_subtotal, p_tax, p_discount, p_total,
    p_payment_method, p_loyalty_points_earned, p_loyalty_points_redeemed, 'completed'
  ) RETURNING * INTO v_tx;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.transaction_items (
      transaction_id, product_id, variant_id, product_name, quantity, unit_price, total_price
    ) VALUES (
      v_tx.id,
      (item->>'product_id')::uuid,
      NULLIF(item->>'variant_id','')::uuid,
      item->>'product_name',
      (item->>'quantity')::integer,
      (item->>'unit_price')::numeric,
      (item->>'total_price')::numeric
    );
  END LOOP;

  RETURN v_tx;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pos_transaction(uuid,uuid,text,numeric,numeric,numeric,numeric,integer,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pos_transaction(uuid,uuid,text,numeric,numeric,numeric,numeric,integer,integer,jsonb) TO authenticated;

-- END MIGRATION: 20260831110000_unified_visual_pos.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20260831113000_pos_cost_ledger.sql
----------------------------------------------------------------------------------------------------
-- Preserve the exact inventory cost at the moment of sale so historical profit
-- remains correct even when catalogue costs are changed later.
ALTER TABLE public.transaction_items
  ADD COLUMN IF NOT EXISTS unit_cost numeric(10,2);

CREATE INDEX IF NOT EXISTS idx_transaction_items_product_variant
  ON public.transaction_items(product_id, variant_id);

-- Rebuild the authoritative POS RPC so every sale snapshots its unit cost.
CREATE OR REPLACE FUNCTION public.create_pos_transaction(
  p_cashier_id uuid,
  p_customer_id uuid,
  p_payment_method text,
  p_subtotal numeric,
  p_tax numeric,
  p_discount numeric,
  p_total numeric,
  p_loyalty_points_earned integer,
  p_loyalty_points_redeemed integer,
  p_items jsonb
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_price numeric;
  v_cost numeric;
  v_bill_cost numeric := 0;
  v_bill_revenue numeric := 0;
  v_min_profit numeric := 0;
  v_tx public.transactions;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_cashier_id OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'POS_UNAUTHORIZED';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'POS_EMPTY_BILL';
  END IF;

  SELECT CASE
    WHEN jsonb_typeof(value) = 'object' AND value ? 'amount' THEN (value->>'amount')::numeric
    WHEN jsonb_typeof(value) = 'number' THEN value::text::numeric
    ELSE 0
  END
  INTO v_min_profit
  FROM public.app_settings
  WHERE key = 'minimum_bill_gross_profit';
  v_min_profit := COALESCE(v_min_profit, 0);

  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (item->>'product_id')::uuid;
    v_variant_id := NULLIF(item->>'variant_id','')::uuid;
    v_quantity := (item->>'quantity')::integer;
    v_unit_price := (item->>'unit_price')::numeric;

    IF v_quantity <= 0 OR v_unit_price < 0 THEN
      RAISE EXCEPTION 'POS_INVALID_ITEM';
    END IF;

    IF v_variant_id IS NOT NULL THEN
      SELECT cost, quantity INTO v_cost, v_quantity
      FROM public.product_variants
      WHERE id = v_variant_id AND product_id = v_product_id
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'POS_VARIANT_NOT_FOUND'; END IF;
      IF v_quantity < (item->>'quantity')::integer THEN RAISE EXCEPTION 'POS_INSUFFICIENT_STOCK'; END IF;
      v_quantity := (item->>'quantity')::integer;
    ELSE
      SELECT cost, quantity INTO v_cost, v_quantity
      FROM public.products
      WHERE id = v_product_id
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'POS_PRODUCT_NOT_FOUND'; END IF;
      IF v_quantity < (item->>'quantity')::integer THEN RAISE EXCEPTION 'POS_INSUFFICIENT_STOCK'; END IF;
      v_quantity := (item->>'quantity')::integer;
    END IF;

    v_bill_cost := v_bill_cost + COALESCE(v_cost, 0) * v_quantity;
    v_bill_revenue := v_bill_revenue + v_unit_price * v_quantity;
  END LOOP;

  IF ABS(v_bill_revenue - COALESCE(p_subtotal,0)) > 0.01 THEN
    RAISE EXCEPTION 'POS_TOTAL_MISMATCH';
  END IF;

  IF (v_bill_revenue - COALESCE(p_discount,0) - v_bill_cost) < v_min_profit THEN
    RAISE EXCEPTION 'BILL_PROFIT_TOO_LOW: gross profit % is below minimum %',
      ROUND(v_bill_revenue - COALESCE(p_discount,0) - v_bill_cost, 2),
      ROUND(v_min_profit, 2);
  END IF;

  IF ABS((v_bill_revenue - COALESCE(p_discount,0) + COALESCE(p_tax,0)) - COALESCE(p_total,0)) > 0.01 THEN
    RAISE EXCEPTION 'POS_TOTAL_MISMATCH';
  END IF;

  INSERT INTO public.transactions (
    cashier_id, customer_id, subtotal, tax, discount, total,
    payment_method, loyalty_points_earned, loyalty_points_redeemed, status
  ) VALUES (
    p_cashier_id, p_customer_id, p_subtotal, p_tax, p_discount, p_total,
    p_payment_method, p_loyalty_points_earned, p_loyalty_points_redeemed, 'completed'
  ) RETURNING * INTO v_tx;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (item->>'product_id')::uuid;
    v_variant_id := NULLIF(item->>'variant_id','')::uuid;
    IF v_variant_id IS NOT NULL THEN
      SELECT cost INTO v_cost FROM public.product_variants WHERE id = v_variant_id AND product_id = v_product_id;
    ELSE
      SELECT cost INTO v_cost FROM public.products WHERE id = v_product_id;
    END IF;

    INSERT INTO public.transaction_items (
      transaction_id, product_id, variant_id, product_name, quantity,
      unit_price, total_price, unit_cost
    ) VALUES (
      v_tx.id,
      v_product_id,
      v_variant_id,
      item->>'product_name',
      (item->>'quantity')::integer,
      (item->>'unit_price')::numeric,
      (item->>'total_price')::numeric,
      COALESCE(v_cost, 0)
    );
  END LOOP;

  RETURN v_tx;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pos_transaction(uuid,uuid,text,numeric,numeric,numeric,numeric,integer,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pos_transaction(uuid,uuid,text,numeric,numeric,numeric,numeric,integer,integer,jsonb) TO authenticated;

-- END MIGRATION: 20260831113000_pos_cost_ledger.sql

----------------------------------------------------------------------------------------------------
-- BEGIN MIGRATION: 20260831130000_secure_integration_credentials.sql
----------------------------------------------------------------------------------------------------
-- Secure integration credential store.
-- Secrets are encrypted by the integration-credentials Edge Function before storage.
CREATE TABLE IF NOT EXISTS public.integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('razorpay','payu','meesho','flipkart','amazon','shipping','whatsapp','email')),
  environment TEXT NOT NULL DEFAULT 'test' CHECK (environment IN ('test','live','production')),
  credentials_ciphertext TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_tested_at TIMESTAMPTZ,
  last_test_status TEXT CHECK (last_test_status IN ('success','failed','unknown')),
  last_test_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, environment)
);

ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage integration credentials" ON public.integration_credentials;
CREATE POLICY "Admins can manage integration credentials"
ON public.integration_credentials
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Do not expose this table to normal staff. The frontend talks to the secure Edge Function.
DROP POLICY IF EXISTS "Staff can view integration credentials" ON public.integration_credentials;

CREATE OR REPLACE FUNCTION public.touch_integration_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_touch_integration_credentials ON public.integration_credentials;
CREATE TRIGGER trg_touch_integration_credentials
BEFORE UPDATE ON public.integration_credentials
FOR EACH ROW EXECUTE FUNCTION public.touch_integration_credentials_updated_at();

COMMENT ON TABLE public.integration_credentials IS 'Encrypted marketplace/payment/provider credentials. Ciphertext is produced by the Edge Function; secrets are never returned to the browser.';

-- END MIGRATION: 20260831130000_secure_integration_credentials.sql

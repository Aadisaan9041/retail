-- ============================================
-- RetailPro POS - Complete Database Schema
-- Generated: 2026-01-23
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'cashier');

-- ============================================
-- FUNCTIONS
-- ============================================

-- Check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check if user is any staff role
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
  )
$$;

-- Check if user is customer
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

-- Check if user has any role
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

-- Get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

-- Update customer loyalty after transaction
CREATE OR REPLACE FUNCTION public.update_customer_loyalty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Update product quantity after sale
CREATE OR REPLACE FUNCTION public.update_product_quantity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.products
  SET quantity = quantity - NEW.quantity,
      updated_at = now()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

-- Check auto reorder threshold
CREATE OR REPLACE FUNCTION public.check_auto_reorder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- ============================================
-- TABLES
-- ============================================

-- User Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User Roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL DEFAULT 'cashier',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- App Settings (key-value store)
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Product Categories
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Products
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  category_id UUID REFERENCES public.categories(id),
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  reorder_quantity INTEGER DEFAULT 50,
  auto_reorder BOOLEAN DEFAULT false,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Customers
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  loyalty_points INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Loyalty Tiers
CREATE TABLE public.loyalty_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  min_points INTEGER NOT NULL DEFAULT 0,
  discount_percentage NUMERIC NOT NULL DEFAULT 0,
  benefits TEXT[],
  color TEXT DEFAULT '#667eea',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Loyalty Points History
CREATE TABLE public.loyalty_points_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  points INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  transaction_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Transactions
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cashier_id UUID,
  customer_id UUID REFERENCES public.customers(id),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  status TEXT DEFAULT 'completed',
  loyalty_points_earned INTEGER DEFAULT 0,
  loyalty_points_redeemed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Transaction Items
CREATE TABLE public.transaction_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Reorder Requests
CREATE TABLE public.reorder_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Delivery Partners
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

-- Orders (Webstore)
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

-- Price Override Logs
CREATE TABLE public.price_override_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES public.transactions(id),
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  original_price NUMERIC NOT NULL,
  modified_price NUMERIC NOT NULL,
  user_id UUID NOT NULL,
  user_name TEXT,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_points_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reorder_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_override_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

-- ============================================
-- USER ROLES POLICIES
-- ============================================

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view roles"
ON public.user_roles FOR SELECT
USING (is_staff(auth.uid()));

-- ============================================
-- APP SETTINGS POLICIES
-- ============================================

CREATE POLICY "Admins can manage app settings"
ON public.app_settings FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view app settings"
ON public.app_settings FOR SELECT
USING (is_staff(auth.uid()));

-- ============================================
-- CATEGORIES POLICIES
-- ============================================

CREATE POLICY "Anyone can view categories"
ON public.categories FOR SELECT
USING (true);

CREATE POLICY "Admins can manage categories"
ON public.categories FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- ============================================
-- PRODUCTS POLICIES
-- ============================================

CREATE POLICY "Anyone can view products"
ON public.products FOR SELECT
USING (true);

CREATE POLICY "Admins/Managers can manage products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Staff can update product quantity"
ON public.products FOR UPDATE TO authenticated
USING (is_staff(auth.uid()));

CREATE POLICY "Admins/Managers can delete products"
ON public.products FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- ============================================
-- CUSTOMERS POLICIES
-- ============================================

CREATE POLICY "Staff can manage customers"
ON public.customers FOR ALL TO authenticated
USING (is_staff(auth.uid()));

-- ============================================
-- LOYALTY TIERS POLICIES
-- ============================================

CREATE POLICY "Anyone can view loyalty tiers"
ON public.loyalty_tiers FOR SELECT
USING (true);

CREATE POLICY "Admins can manage loyalty tiers"
ON public.loyalty_tiers FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- ============================================
-- LOYALTY POINTS HISTORY POLICIES
-- ============================================

CREATE POLICY "Staff can view points history"
ON public.loyalty_points_history FOR SELECT
USING (is_staff(auth.uid()));

CREATE POLICY "Staff can create points history"
ON public.loyalty_points_history FOR INSERT
WITH CHECK (is_staff(auth.uid()));

-- ============================================
-- TRANSACTIONS POLICIES
-- ============================================

CREATE POLICY "Staff can create transactions"
ON public.transactions FOR INSERT
WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Anyone can create transactions"
ON public.transactions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Staff can view transactions"
ON public.transactions FOR SELECT
USING (is_staff(auth.uid()));

-- ============================================
-- TRANSACTION ITEMS POLICIES
-- ============================================

CREATE POLICY "Staff can create transaction items"
ON public.transaction_items FOR INSERT
WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Anyone can create transaction items"
ON public.transaction_items FOR INSERT
WITH CHECK (true);

CREATE POLICY "Staff can view transaction items"
ON public.transaction_items FOR SELECT
USING (is_staff(auth.uid()));

-- ============================================
-- REORDER REQUESTS POLICIES
-- ============================================

CREATE POLICY "Staff can view reorder requests"
ON public.reorder_requests FOR SELECT
USING (is_staff(auth.uid()));

CREATE POLICY "System can create reorder requests"
ON public.reorder_requests FOR INSERT
WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Admins can manage reorder requests"
ON public.reorder_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- ============================================
-- DELIVERY PARTNERS POLICIES
-- ============================================

CREATE POLICY "Anyone can view active delivery partners"
ON public.delivery_partners FOR SELECT
USING (is_active = true);

CREATE POLICY "Staff can view delivery partners"
ON public.delivery_partners FOR SELECT
USING (is_staff(auth.uid()));

CREATE POLICY "Admins can manage delivery partners"
ON public.delivery_partners FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- ============================================
-- ORDERS POLICIES
-- ============================================

CREATE POLICY "Anyone can create orders"
ON public.orders FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view orders by tracking"
ON public.orders FOR SELECT
USING (true);

CREATE POLICY "Staff can manage orders"
ON public.orders FOR ALL
USING (is_staff(auth.uid()));

-- ============================================
-- PRICE OVERRIDE LOGS POLICIES
-- ============================================

CREATE POLICY "Staff can view price override logs"
ON public.price_override_logs FOR SELECT
USING (is_staff(auth.uid()));

CREATE POLICY "Staff can create price override logs"
ON public.price_override_logs FOR INSERT
WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Only admins/managers can delete logs"
ON public.price_override_logs FOR DELETE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamps
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_partners_updated_at
BEFORE UPDATE ON public.delivery_partners
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Business logic triggers
CREATE TRIGGER on_transaction_created
AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION update_customer_loyalty();

CREATE TRIGGER on_transaction_item_created
AFTER INSERT ON public.transaction_items
FOR EACH ROW EXECUTE FUNCTION update_product_quantity();

CREATE TRIGGER on_product_quantity_change
AFTER UPDATE OF quantity ON public.products
FOR EACH ROW EXECUTE FUNCTION check_auto_reorder();

-- ============================================
-- STORAGE BUCKET
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Staff can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND is_staff(auth.uid())
);

CREATE POLICY "Staff can update product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images' 
  AND is_staff(auth.uid())
);

CREATE POLICY "Staff can delete product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images' 
  AND is_staff(auth.uid())
);

-- ============================================
-- SAMPLE DATA (Optional)
-- ============================================

-- Insert default loyalty tiers
INSERT INTO public.loyalty_tiers (name, min_points, discount_percentage, benefits, color) VALUES
('Bronze', 0, 0, ARRAY['Basic member benefits'], '#cd7f32'),
('Silver', 500, 5, ARRAY['5% discount', 'Early access to sales'], '#c0c0c0'),
('Gold', 1000, 10, ARRAY['10% discount', 'Free shipping', 'Priority support'], '#ffd700'),
('Platinum', 5000, 15, ARRAY['15% discount', 'Free shipping', 'VIP support', 'Exclusive deals'], '#e5e4e2')
ON CONFLICT DO NOTHING;

-- Insert default categories
INSERT INTO public.categories (name, description) VALUES
('Electronics', 'Electronic devices and accessories'),
('Clothing', 'Apparel and fashion items'),
('Food & Beverages', 'Consumable items'),
('Home & Garden', 'Home decor and gardening supplies')
ON CONFLICT DO NOTHING;

-- Variant-aware transaction item support
ALTER TABLE public.transaction_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id);

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
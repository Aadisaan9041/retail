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

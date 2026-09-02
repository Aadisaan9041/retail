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
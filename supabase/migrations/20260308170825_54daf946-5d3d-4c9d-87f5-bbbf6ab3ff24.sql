
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

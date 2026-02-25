
-- Add email (Zelle) field to company_settings
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS email text;

-- Create standard_items table for preset box sizes with prices
CREATE TABLE public.standard_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.standard_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff/admin can view standard items"
  ON public.standard_items FOR SELECT
  USING (is_admin_or_staff(auth.uid()));

CREATE POLICY "Admins can insert standard items"
  ON public.standard_items FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update standard items"
  ON public.standard_items FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete standard items"
  ON public.standard_items FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default standard items
INSERT INTO public.standard_items (name, price, sort_order) VALUES
  ('Small', 5.00, 1),
  ('Medium', 10.00, 2),
  ('Large', 15.00, 3),
  ('XL', 20.00, 4),
  ('27 Gallons', 25.00, 5);

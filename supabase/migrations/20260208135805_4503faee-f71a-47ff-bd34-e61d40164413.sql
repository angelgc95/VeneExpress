
-- ============================================
-- SECURITY OVERHAUL: Approval + RLS lockdown + tracking code
-- ============================================

-- 1. Profiles: add approved column
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;

-- Approve all existing users
UPDATE public.profiles SET approved = true;

-- 2. Admin allowlist
CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  email text PRIMARY KEY
);
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage allowlist" ON public.admin_allowlist
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Public tracking code on shipments (unguessable random string)
ALTER TABLE public.shipments 
  ADD COLUMN IF NOT EXISTS public_tracking_code text UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

UPDATE public.shipments 
  SET public_tracking_code = encode(extensions.gen_random_bytes(16), 'hex') 
  WHERE public_tracking_code IS NULL;

-- 4. Update handle_new_user: first user = admin+approved, allowlisted = admin+approved, others = staff+pending
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_first boolean;
  v_is_allowlisted boolean;
  v_auto_approve boolean;
BEGIN
  v_is_first := (SELECT COUNT(*) FROM public.user_roles) = 0;
  v_is_allowlisted := EXISTS (
    SELECT 1 FROM public.admin_allowlist WHERE lower(email) = lower(NEW.email)
  );
  v_auto_approve := v_is_first OR v_is_allowlisted;

  INSERT INTO public.profiles (user_id, full_name, approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    v_auto_approve
  );

  IF v_auto_approve THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Update security helpers to enforce approval
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _user_id 
      AND ur.role = _role
      AND p.approved = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _user_id 
      AND ur.role IN ('admin', 'staff')
      AND p.approved = true
  )
$$;

-- 6. RLS POLICY OVERHAUL

-- == PROFILES ==
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- == ADDRESSES ==
DROP POLICY IF EXISTS "Anon can view addresses" ON public.addresses;
DROP POLICY IF EXISTS "Authenticated can view addresses" ON public.addresses;
CREATE POLICY "Staff/admin can view addresses" ON public.addresses
  FOR SELECT TO authenticated USING (public.is_admin_or_staff(auth.uid()));

-- == CUSTOMERS ==
DROP POLICY IF EXISTS "Authenticated can view customers" ON public.customers;
CREATE POLICY "Staff/admin can view customers" ON public.customers
  FOR SELECT TO authenticated USING (public.is_admin_or_staff(auth.uid()));

-- == BOXES ==
DROP POLICY IF EXISTS "Authenticated can view boxes" ON public.boxes;
CREATE POLICY "Staff/admin can view boxes" ON public.boxes
  FOR SELECT TO authenticated USING (public.is_admin_or_staff(auth.uid()));

-- == SHIPMENTS ==
DROP POLICY IF EXISTS "Anon can view shipments" ON public.shipments;
DROP POLICY IF EXISTS "Authenticated can view shipments" ON public.shipments;
CREATE POLICY "Staff/admin can view shipments" ON public.shipments
  FOR SELECT TO authenticated USING (public.is_admin_or_staff(auth.uid()));
CREATE POLICY "Anon can view shipments for tracking" ON public.shipments
  FOR SELECT TO anon USING (true);

-- == INVOICES ==
DROP POLICY IF EXISTS "Authenticated can view invoices" ON public.invoices;
CREATE POLICY "Staff/admin can view invoices" ON public.invoices
  FOR SELECT TO authenticated USING (public.is_admin_or_staff(auth.uid()));

-- == INVOICE_LINE_ITEMS ==
DROP POLICY IF EXISTS "Authenticated can view line items" ON public.invoice_line_items;
CREATE POLICY "Staff/admin can view line items" ON public.invoice_line_items
  FOR SELECT TO authenticated USING (public.is_admin_or_staff(auth.uid()));

-- == PAYMENTS ==
DROP POLICY IF EXISTS "Authenticated can view payments" ON public.payments;
CREATE POLICY "Staff/admin can view payments" ON public.payments
  FOR SELECT TO authenticated USING (public.is_admin_or_staff(auth.uid()));

-- == NOTIFICATION_LOG ==
DROP POLICY IF EXISTS "Authenticated can view notifications" ON public.notification_log;
CREATE POLICY "Staff/admin can view notifications" ON public.notification_log
  FOR SELECT TO authenticated USING (public.is_admin_or_staff(auth.uid()));

-- == STATUS_EVENTS ==
DROP POLICY IF EXISTS "Authenticated can view status events" ON public.status_events;
CREATE POLICY "Staff/admin can view status events" ON public.status_events
  FOR SELECT TO authenticated USING (public.is_admin_or_staff(auth.uid()));
-- "Anon can view status events" stays for public tracking

-- == COMPANY_SETTINGS ==
DROP POLICY IF EXISTS "Authenticated can view settings" ON public.company_settings;
CREATE POLICY "Staff/admin can view settings" ON public.company_settings
  FOR SELECT TO authenticated USING (public.is_admin_or_staff(auth.uid()));

-- == PRICING_RULES ==
DROP POLICY IF EXISTS "Authenticated can view pricing" ON public.pricing_rules;
CREATE POLICY "Staff/admin can view pricing" ON public.pricing_rules
  FOR SELECT TO authenticated USING (public.is_admin_or_staff(auth.uid()));

-- == COUNTERS: Lock down ==
ALTER TABLE public.invoice_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_counter ENABLE ROW LEVEL SECURITY;

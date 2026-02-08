
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'readonly');
CREATE TYPE public.service_type AS ENUM ('SEA', 'AIR');
CREATE TYPE public.shipment_status AS ENUM ('Created', 'In Warehouse', 'Paid', 'Shipped', 'Delivered');
CREATE TYPE public.payment_method AS ENUM ('cash', 'zelle', 'card', 'other');
CREATE TYPE public.payment_status AS ENUM ('Unpaid', 'Partial', 'Paid');
CREATE TYPE public.invoice_line_type AS ENUM ('shipping', 'discount', 'misc');

-- User roles table (separate from profiles per security best practice)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'readonly',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: check if user is admin or staff
CREATE OR REPLACE FUNCTION public.is_admin_or_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin', 'staff')
  )
$$;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Addresses
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  state TEXT,
  postal_code TEXT,
  country TEXT NOT NULL DEFAULT 'US',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

-- Shipment counter for human-friendly IDs
CREATE TABLE public.shipment_counter (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_number INTEGER NOT NULL DEFAULT 0
);
INSERT INTO public.shipment_counter (id, last_number) VALUES (1, 0);

-- Generate shipment ID function
CREATE OR REPLACE FUNCTION public.generate_shipment_id()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE next_num INTEGER; year_part TEXT;
BEGIN
  UPDATE shipment_counter SET last_number = last_number + 1 WHERE id = 1 RETURNING last_number INTO next_num;
  year_part := EXTRACT(YEAR FROM now())::TEXT;
  RETURN 'VE-' || year_part || '-' || LPAD(next_num::TEXT, 6, '0');
END;
$$;

-- Shipments
CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id TEXT NOT NULL UNIQUE DEFAULT public.generate_shipment_id(),
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  sender_address_id UUID REFERENCES public.addresses(id),
  receiver_address_id UUID REFERENCES public.addresses(id),
  service_type service_type NOT NULL DEFAULT 'SEA',
  currency TEXT NOT NULL DEFAULT 'USD',
  status shipment_status NOT NULL DEFAULT 'Created',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- Pricing rules
CREATE TABLE public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  route TEXT NOT NULL DEFAULT 'USA→VE',
  service_type service_type NOT NULL,
  rate_per_ft3 NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

-- Seed default pricing
INSERT INTO public.pricing_rules (name, route, service_type, rate_per_ft3, is_active)
VALUES ('Standard Sea Rate', 'USA→VE', 'SEA', 25.00, true);

-- Boxes
CREATE TABLE public.boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id TEXT NOT NULL UNIQUE,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE NOT NULL,
  length_in NUMERIC(10,2) NOT NULL,
  width_in NUMERIC(10,2) NOT NULL,
  height_in NUMERIC(10,2) NOT NULL,
  volume_ft3 NUMERIC(10,4) GENERATED ALWAYS AS ((length_in * width_in * height_in) / 1728.0) STORED,
  applied_rate NUMERIC(10,2),
  calculated_price NUMERIC(10,2),
  price_override NUMERIC(10,2),
  override_reason TEXT,
  final_price NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.boxes ENABLE ROW LEVEL SECURITY;

-- Invoices
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  shipment_id UUID REFERENCES public.shipments(id) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  adjustment NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status payment_status NOT NULL DEFAULT 'Unpaid',
  is_finalized BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at TIMESTAMPTZ
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Invoice counter
CREATE TABLE public.invoice_counter (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_number INTEGER NOT NULL DEFAULT 0
);
INSERT INTO public.invoice_counter (id, last_number) VALUES (1, 0);

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE next_num INTEGER;
BEGIN
  UPDATE invoice_counter SET last_number = last_number + 1 WHERE id = 1 RETURNING last_number INTO next_num;
  RETURN 'INV-' || LPAD(next_num::TEXT, 6, '0');
END;
$$;

-- Invoice line items
CREATE TABLE public.invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  type invoice_line_type NOT NULL DEFAULT 'shipping',
  description TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  line_total NUMERIC(10,2) NOT NULL
);
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) NOT NULL,
  method payment_method NOT NULL DEFAULT 'cash',
  amount NUMERIC(10,2) NOT NULL,
  reference TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Status events
CREATE TABLE public.status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES public.shipments(id) NOT NULL,
  box_id UUID REFERENCES public.boxes(id),
  status shipment_status NOT NULL,
  note TEXT,
  actor_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.status_events ENABLE ROW LEVEL SECURITY;

-- Notification log
CREATE TABLE public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES public.shipments(id) NOT NULL,
  channel TEXT NOT NULL DEFAULT 'WhatsApp',
  to_phone TEXT NOT NULL,
  template_name TEXT,
  message_body TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Company settings
CREATE TABLE public.company_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'Angel Shipping',
  phone TEXT,
  address TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.company_settings (name) VALUES ('Angel Shipping');
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Auto-create profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));
  -- First user gets admin, others get staff
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON public.pricing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== RLS POLICIES ==========

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE POLICY "Authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Customers
CREATE POLICY "Authenticated can view customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_staff(auth.uid()));
CREATE POLICY "Staff can update customers" ON public.customers FOR UPDATE TO authenticated USING (public.is_admin_or_staff(auth.uid()));

-- Addresses
CREATE POLICY "Authenticated can view addresses" ON public.addresses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert addresses" ON public.addresses FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_staff(auth.uid()));
CREATE POLICY "Staff can update addresses" ON public.addresses FOR UPDATE TO authenticated USING (public.is_admin_or_staff(auth.uid()));

-- Shipments (also anon for public tracking)
CREATE POLICY "Authenticated can view shipments" ON public.shipments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can view shipments" ON public.shipments FOR SELECT TO anon USING (true);
CREATE POLICY "Staff can insert shipments" ON public.shipments FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_staff(auth.uid()));
CREATE POLICY "Staff can update shipments" ON public.shipments FOR UPDATE TO authenticated USING (public.is_admin_or_staff(auth.uid()));

-- Boxes
CREATE POLICY "Authenticated can view boxes" ON public.boxes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert boxes" ON public.boxes FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_staff(auth.uid()));
CREATE POLICY "Staff can update boxes" ON public.boxes FOR UPDATE TO authenticated USING (public.is_admin_or_staff(auth.uid()));
CREATE POLICY "Staff can delete boxes" ON public.boxes FOR DELETE TO authenticated USING (public.is_admin_or_staff(auth.uid()));

-- Pricing rules
CREATE POLICY "Authenticated can view pricing" ON public.pricing_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert pricing" ON public.pricing_rules FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update pricing" ON public.pricing_rules FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete pricing" ON public.pricing_rules FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Invoices
CREATE POLICY "Authenticated can view invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_staff(auth.uid()));
CREATE POLICY "Staff can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (public.is_admin_or_staff(auth.uid()));

-- Invoice line items
CREATE POLICY "Authenticated can view line items" ON public.invoice_line_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert line items" ON public.invoice_line_items FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_staff(auth.uid()));
CREATE POLICY "Staff can update line items" ON public.invoice_line_items FOR UPDATE TO authenticated USING (public.is_admin_or_staff(auth.uid()));
CREATE POLICY "Staff can delete line items" ON public.invoice_line_items FOR DELETE TO authenticated USING (public.is_admin_or_staff(auth.uid()));

-- Payments
CREATE POLICY "Authenticated can view payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_staff(auth.uid()));

-- Status events (also anon for public tracking)
CREATE POLICY "Authenticated can view status events" ON public.status_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can view status events" ON public.status_events FOR SELECT TO anon USING (true);
CREATE POLICY "Staff can insert status events" ON public.status_events FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_staff(auth.uid()));

-- Notification log
CREATE POLICY "Authenticated can view notifications" ON public.notification_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert notifications" ON public.notification_log FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_staff(auth.uid()));

-- Company settings
CREATE POLICY "Authenticated can view settings" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update settings" ON public.company_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Counter tables (accessed only via security definer functions)
ALTER TABLE public.shipment_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_counter ENABLE ROW LEVEL SECURITY;

-- Addresses anon access for tracking
CREATE POLICY "Anon can view addresses" ON public.addresses FOR SELECT TO anon USING (true);

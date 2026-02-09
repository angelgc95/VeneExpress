-- Add RLS policies to counter tables (currently accessed only via SECURITY DEFINER functions,
-- but adding explicit policies for defense in depth)

-- shipment_counter: only staff/admin should be able to read; updates happen via generate_shipment_id()
CREATE POLICY "Staff/admin can view shipment counter"
ON public.shipment_counter
FOR SELECT
USING (is_admin_or_staff(auth.uid()));

-- invoice_counter: only staff/admin should be able to read; updates happen via generate_invoice_number()
CREATE POLICY "Staff/admin can view invoice counter"
ON public.invoice_counter
FOR SELECT
USING (is_admin_or_staff(auth.uid()));
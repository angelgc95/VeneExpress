-- Add DELETE policies for tables that need cascading deletion support

-- Shipments: allow staff/admin to delete
CREATE POLICY "Staff can delete shipments"
ON public.shipments FOR DELETE
USING (is_admin_or_staff(auth.uid()));

-- Notification log: allow staff/admin to delete
CREATE POLICY "Staff can delete notifications"
ON public.notification_log FOR DELETE
USING (is_admin_or_staff(auth.uid()));

-- Payments: allow staff/admin to delete
CREATE POLICY "Staff can delete payments"
ON public.payments FOR DELETE
USING (is_admin_or_staff(auth.uid()));

-- Invoices: allow staff/admin to delete
CREATE POLICY "Staff can delete invoices"
ON public.invoices FOR DELETE
USING (is_admin_or_staff(auth.uid()));

-- Addresses: allow staff/admin to delete (for cleanup)
CREATE POLICY "Staff can delete addresses"
ON public.addresses FOR DELETE
USING (is_admin_or_staff(auth.uid()));
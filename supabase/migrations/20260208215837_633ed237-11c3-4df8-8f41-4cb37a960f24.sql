
-- Allow staff/admin to delete customers
CREATE POLICY "Staff can delete customers"
ON public.customers
FOR DELETE
USING (is_admin_or_staff(auth.uid()));
